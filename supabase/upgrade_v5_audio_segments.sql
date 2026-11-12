-- v5: split large MP3 audio into individually playable objects below 50 MB.
-- Each track remains a single admin item, with ordered Storage paths in parts.
-- Existing tracks keep using storage_path as a fallback.
alter table public.audio_tracks
  add column if not exists parts jsonb not null default '[]'::jsonb;
alter table public.audio_tracks
  add constraint audio_parts_are_array check (jsonb_typeof(parts) = 'array');
-- Keep grants/RLS from v3, and the portrait fields from v4.
create or replace function public.get_screen_manifest(screen_public_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select case when s.id is null then null else jsonb_build_object(
  'name', s.name,
  'location', coalesce(l.name, ''),
  'synchronized', coalesce(p.synchronized, false),
  'sync_anchor', p.sync_anchor,
  'server_time', now(),
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


revoke all on function public.get_screen_manifest(uuid) from public, anon, authenticated;
grant execute on function public.get_screen_manifest(uuid) to anon, authenticated;
