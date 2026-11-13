-- Screenflow v6: schedule automatic playback by location and issue authenticated player commands.
-- This schedules the Screenflow PLAYER only; it does not power on/off the physical TV.
alter table public.locations
 add column if not exists schedule_enabled boolean not null default false,
 add column if not exists open_time time without time zone not null default '15:00',
 add column if not exists close_time time without time zone not null default '02:00';
alter table public.screens
 add column if not exists playback_enabled boolean not null default true,
 add column if not exists reload_requested_at timestamptz;

-- Preserve existing audio and vertical-video fields from v3-v5.
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
