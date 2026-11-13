-- Screenflow v8: manual curated Instagram Wall & extensible Smart Modes.
-- No Instagram credentials, tokens, or post scraping stored here.
alter table public.locations
 add column if not exists display_mode text not null default 'ads'
   check(display_mode in ('ads','menu','happy_hour','event','vote','karaoke','welcome','live','instagram','photo_wall','social_wall','loyalty','information')),
 add column if not exists instagram_handle text not null default '';
create table if not exists public.smart_items(
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  mode text not null check(mode in ('menu','happy_hour','event','vote','karaoke','welcome','live','instagram','photo_wall','social_wall','loyalty','information')),
  title text not null check(char_length(title) between 1 and 150),
  subtitle text not null default '',
  body text not null default '',
  author_handle text not null default '',
  post_url text not null default '',
  asset_id uuid references public.assets(id) on delete set null,
  duration_seconds int not null default 15 check(duration_seconds between 3 and 3600),
  sort_order int not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create index if not exists smart_items_location_mode_idx on public.smart_items(location_id,mode,sort_order);
alter table public.smart_items enable row level security;
drop policy if exists "admin smart items" on public.smart_items;
create policy "admin smart items" on public.smart_items for all to authenticated
 using(public.is_signage_admin()) with check(public.is_signage_admin());
grant select,insert,update,delete on public.smart_items to authenticated;

-- TV reads only the curated, non-sensitive fields through the public screen
-- manifest, not the smart_items table. Existing ads and audio remain intact.
create or replace function public.get_screen_manifest(screen_public_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select case when s.id is null then null else jsonb_build_object(
  'name', s.name,
  'location', coalesce(l.name, ''),
  'synchronized', coalesce(p.synchronized, false),
  'sync_anchor', p.sync_anchor,
  'server_time', now(),
  'playback_enabled', s.playback_enabled,
  'reload_requested_at', s.reload_requested_at,
  'schedule_enabled', coalesce(l.schedule_enabled,false),
  'schedule_open_time', to_char(l.open_time,'HH24:MI'),
  'schedule_close_time', to_char(l.close_time,'HH24:MI'),
  'schedule_open', case when not coalesce(l.schedule_enabled,false) then true
   when l.open_time=l.close_time then true
   when l.open_time<l.close_time then (now() at time zone 'Europe/Bucharest')::time >= l.open_time
     and (now() at time zone 'Europe/Bucharest')::time < l.close_time
   else (now() at time zone 'Europe/Bucharest')::time >= l.open_time
     or (now() at time zone 'Europe/Bucharest')::time < l.close_time end,
  'video_audio_enabled', coalesce(p.video_audio_enabled, false),
  'video_volume', coalesce(p.video_volume, 35),
  'background_audio_enabled', coalesce(p.background_audio_enabled, false),
  'background_volume', coalesce(p.background_volume, 25),
  'background_track_path', case when p.background_audio_enabled then track.storage_path else null end,
  'background_track_parts', case when p.background_audio_enabled then
    case when jsonb_array_length(coalesce(track.parts,'[]'::jsonb)) > 0 then track.parts
      when track.storage_path is not null then jsonb_build_array(track.storage_path)
      else '[]'::jsonb end
    else '[]'::jsonb end,
  'display_mode',coalesce(l.display_mode,'ads'),
  'instagram_handle',coalesce(l.instagram_handle,''),
  'smart_items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',i.id,'mode',i.mode,'title',i.title,'subtitle',i.subtitle,
    'body',i.body,'author_handle',i.author_handle,'post_url',i.post_url,
    'duration_seconds',i.duration_seconds,
    'storage_path',a.storage_path,'kind',a.kind,
    'blur_background_path',a.blur_background_path
   ) order by i.sort_order,i.created_at)
   from public.smart_items i
   left join public.assets a on a.id=i.asset_id and a.enabled
   where i.location_id=l.id and i.enabled=true
   and (i.starts_at is null or i.starts_at<=now())
   and (i.ends_at is null or i.ends_at>now())
  ),'[]'::jsonb),
  'items', coalesce((select jsonb_agg(jsonb_build_object(
   'id', a.id, 'title', a.title, 'kind', a.kind, 'storage_path', a.storage_path,
   'duration_seconds', coalesce(pi.duration_override, a.duration_seconds),
   'blur_background_path', a.blur_background_path
  ) order by pi.position, pi.created_at)
    from public.playlist_items pi
    join public.assets a on a.id = pi.asset_id
    where pi.playlist_id = s.playlist_id
      and a.enabled
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at > now())
  ), '[]'::jsonb)
 ) end
 from public.screens s
 left join public.locations l on l.id = s.location_id
 left join public.playlists p on p.id = s.playlist_id
 left join public.audio_tracks track on track.id = p.background_track_id
 where s.public_id = screen_public_id limit 1;
$$;
revoke all on function public.get_screen_manifest(uuid) from public;
grant execute on function public.get_screen_manifest(uuid) to anon, authenticated;
