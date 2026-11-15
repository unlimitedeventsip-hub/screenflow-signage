-- Proof-of-play events are emitted by authenticated TV installations, not
-- inferred from page views. They prove the app reported playback, not a viewer.
create table public.screenflow_tv_media_events(
  id bigint generated always as identity primary key,
  installation_id uuid not null references public.tv_installations(installation_id) on delete cascade,
  screen_id uuid not null references public.screens(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  event_name text not null check(event_name in ('started','completed','failed')),
  duration_ms integer not null default 0 check(duration_ms between 0 and 3600000),
  occurred_at timestamptz not null default now()
);
create index screenflow_tv_media_period_idx on public.screenflow_tv_media_events(occurred_at desc,screen_id,asset_id);
create index screenflow_tv_media_device_idx on public.screenflow_tv_media_events(installation_id,occurred_at desc);
alter table public.screenflow_tv_media_events enable row level security;
revoke all on public.screenflow_tv_media_events from public,anon,authenticated;
grant all on public.screenflow_tv_media_events to service_role;
revoke all on sequence public.screenflow_tv_media_events_id_seq from public,anon,authenticated;
grant all on sequence public.screenflow_tv_media_events_id_seq to service_role;

create function public.log_screenflow_tv_media(
  p_installation_id uuid,p_secret text,p_asset_id uuid,p_event_name text,p_duration_ms integer default 0)
returns boolean language plpgsql security definer set search_path=''
as $$
declare r public.tv_installations%rowtype;h text;
begin
  if p_installation_id is null or p_secret is null or p_secret !~ '^[a-f0-9]{64}$'
     or p_asset_id is null or p_event_name not in ('started','completed','failed')
     or p_duration_ms is null or p_duration_ms < 0 or p_duration_ms > 3600000 then return false;end if;
  h:=encode(sha256(convert_to(p_secret,'UTF8')),'hex');
  select * into r from public.tv_installations where installation_id=p_installation_id;
  if not found or r.screen_id is null or r.secret_hash is distinct from h then return false;end if;
  if not exists(select 1 from public.assets where id=p_asset_id) then return false;end if;
  if exists(select 1 from public.screenflow_tv_media_events
    where installation_id=p_installation_id and asset_id=p_asset_id
      and event_name=p_event_name and occurred_at>now()-interval '2 seconds') then return false;end if;
  insert into public.screenflow_tv_media_events(installation_id,screen_id,asset_id,event_name,duration_ms)
    values(p_installation_id,r.screen_id,p_asset_id,p_event_name,p_duration_ms);
  return true;
end $$;
revoke all on function public.log_screenflow_tv_media(uuid,text,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.log_screenflow_tv_media(uuid,text,uuid,text,integer) to anon,authenticated,service_role;

-- Keep detailed anonymous events and staff sign-in records only for 90 days,
-- when a trusted administrator runs the maintenance command.
create function public.purge_screenflow_analytics()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare web_deleted int;login_deleted int;tv_deleted int;
begin
  if not public.is_signage_admin() then raise exception 'Not authorized';end if;
  delete from public.screenflow_analytics_events where occurred_at<now()-interval '90 days';
  get diagnostics web_deleted=row_count;
  delete from public.screenflow_staff_login_events where occurred_at<now()-interval '90 days';
  get diagnostics login_deleted=row_count;
  delete from public.screenflow_tv_media_events where occurred_at<now()-interval '90 days';
  get diagnostics tv_deleted=row_count;
  return jsonb_build_object('guest_events',web_deleted,'staff_logins',login_deleted,'tv_events',tv_deleted);
end $$;
revoke all on function public.purge_screenflow_analytics() from public,anon,authenticated;
grant execute on function public.purge_screenflow_analytics() to authenticated,service_role;

comment on table public.screenflow_tv_media_events is 'TV client-reported start/completion/failure; not human viewability metrics or certified advertising impressions.';
