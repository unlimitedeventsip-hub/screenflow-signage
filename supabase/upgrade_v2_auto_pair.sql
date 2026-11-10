-- Screenflow 2.0: run on the EXISTING Supabase project; no existing ads, screens or playlists are removed.
alter table public.playlists add column if not exists synchronized boolean not null default false;
alter table public.playlists add column if not exists sync_anchor timestamptz not null default now();

create table if not exists public.tv_installations (
 installation_id uuid primary key,
 secret_hash text not null,
 pair_code text unique,
 pair_expires_at timestamptz,
 screen_id uuid unique references public.screens(id) on delete set null,
 first_seen_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 platform text not null default '',
 client_type text not null default '',
 resolution text not null default '',
 app_version text not null default '',
 playback_state text not null default 'waiting',
 current_asset_id uuid references public.assets(id) on delete set null,
 error_message text not null default ''
);
create index if not exists tv_installations_seen_idx on public.tv_installations(last_seen_at desc);
alter table public.tv_installations enable row level security;
drop policy if exists "tv admins read" on public.tv_installations;
create policy "tv admins read" on public.tv_installations for select to authenticated using (public.is_signage_admin());
grant select on public.tv_installations to authenticated;

create or replace function public.tv_pair_code()
returns text language plpgsql volatile security definer set search_path='' as $$
declare v text; n integer;
begin
 for n in 1..50 loop
  v := (100000 + floor(random()*900000)::integer)::text;
  if not exists (select 1 from public.tv_installations where pair_code=v) then return v; end if;
 end loop;
 raise exception 'Pairing code exhausted';
end;
$$;
revoke all on function public.tv_pair_code() from public,anon,authenticated;

-- Anonymous client can only register its own installation using a 256-bit secret.
create or replace function public.tv_register(
 p_installation_id uuid,p_secret text,
 p_platform text default '',p_client_type text default '',
 p_resolution text default '',p_app_version text default '',
 p_current_asset_id uuid default null,p_playback_state text default 'waiting',
 p_error_message text default ''
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r public.tv_installations%rowtype; hashed text; code text; pub uuid;
begin
 if p_installation_id is null or p_secret is null or p_secret !~ '^[0-9a-f]{64}$' then
  return jsonb_build_object('status','invalid');
 end if;
 hashed := encode(sha256(convert_to(p_secret,'UTF8')),'hex');
 select * into r from public.tv_installations where installation_id=p_installation_id for update;
 if not found then
  delete from public.tv_installations where screen_id is null and last_seen_at < now()-interval '7 days';
  if (select count(*) from public.tv_installations where screen_id is null)>999 then
   return jsonb_build_object('status','busy');
  end if;
  code := public.tv_pair_code();
  insert into public.tv_installations(installation_id,secret_hash,pair_code,pair_expires_at,platform,client_type,resolution,app_version)
  values(p_installation_id,hashed,code,now()+interval '30 minutes',left(coalesce(p_platform,''),50),
         left(coalesce(p_client_type,''),50),left(coalesce(p_resolution,''),32),left(coalesce(p_app_version,''),35))
  on conflict(installation_id) do nothing;
  select * into r from public.tv_installations where installation_id=p_installation_id for update;
 end if;
 if r.secret_hash is distinct from hashed then return jsonb_build_object('status','invalid'); end if;
 if r.screen_id is null and (r.pair_expires_at is null or r.pair_expires_at<now()) then
  code := public.tv_pair_code();
  update public.tv_installations set pair_code=code,pair_expires_at=now()+interval '30 minutes'
   where installation_id=p_installation_id;
  r.pair_code:=code;
 end if;
 update public.tv_installations set last_seen_at=now(),
  platform=left(coalesce(p_platform,''),50),client_type=left(coalesce(p_client_type,''),50),
  resolution=left(coalesce(p_resolution,''),32),app_version=left(coalesce(p_app_version,''),35),
  current_asset_id=case when exists(select 1 from public.assets where id=p_current_asset_id)
   then p_current_asset_id else null end,
  playback_state=case when p_playback_state in ('playing','waiting','error','background')
    then p_playback_state else 'waiting' end,
  error_message=left(coalesce(p_error_message,''),140)
 where installation_id=p_installation_id;
 if r.screen_id is not null then
  select public_id into pub from public.screens where id=r.screen_id;
  if pub is not null then return jsonb_build_object('status','approved','screen_public_id',pub); end if;
 end if;
 return jsonb_build_object('status','pending','pair_code',r.pair_code);
end;
$$;
revoke all on function public.tv_register(uuid,text,text,text,text,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.tv_register(uuid,text,text,text,text,text,uuid,text,text) to anon,authenticated;

-- Admin confirms code shown on TV; creates screen automatically with selected location/playlist.
create or replace function public.tv_approve(
 p_installation_id uuid,p_pair_code text,p_name text,
 p_location_id uuid default null,p_playlist_id uuid default null
) returns uuid language plpgsql volatile security definer set search_path='' as $$
declare r public.tv_installations%rowtype; sid uuid;
begin
 if not public.is_signage_admin() then raise exception 'Not authorized'; end if;
 if p_name is null or char_length(btrim(p_name)) not between 1 and 100 then raise exception 'Invalid TV name'; end if;
 select * into r from public.tv_installations where installation_id=p_installation_id for update;
 if not found or r.screen_id is not null then raise exception 'Already paired or not found'; end if;
 if r.pair_code is distinct from p_pair_code or r.pair_expires_at < now() then raise exception 'Invalid or expired code'; end if;
 insert into public.screens(name,location_id,playlist_id)
 values(btrim(p_name),p_location_id,p_playlist_id) returning id into sid;
 update public.tv_installations set screen_id=sid,pair_code=null,pair_expires_at=null where installation_id=p_installation_id;
 return sid;
end;
$$;
revoke all on function public.tv_approve(uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.tv_approve(uuid,text,text,uuid,uuid) to authenticated;

-- Existing players continue using their old /play/<uuid> links. New players may sync
-- one playlist via a common timeline, using server_time/sync_anchor.
create or replace function public.get_screen_manifest(screen_public_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select case when s.id is null then null else jsonb_build_object(
  'name',s.name,'location',coalesce(l.name,''),
  'synchronized',coalesce(p.synchronized,false),'sync_anchor',p.sync_anchor,'server_time',now(),
  'items',coalesce((select jsonb_agg(jsonb_build_object(
   'id',a.id,'title',a.title,'kind',a.kind,'storage_path',a.storage_path,
   'duration_seconds',coalesce(pi.duration_override,a.duration_seconds)
  ) order by pi.position,pi.created_at)
   from public.playlist_items pi join public.assets a on a.id=pi.asset_id
   where pi.playlist_id=s.playlist_id and a.enabled
   and (a.starts_at is null or a.starts_at<=now())
   and (a.ends_at is null or a.ends_at>now())), '[]'::jsonb)
 ) end
 from public.screens s
 left join public.locations l on l.id=s.location_id
 left join public.playlists p on p.id=s.playlist_id
 where s.public_id=screen_public_id limit 1;
$$;
revoke all on function public.get_screen_manifest(uuid) from public,anon,authenticated;
grant execute on function public.get_screen_manifest(uuid) to anon,authenticated;
