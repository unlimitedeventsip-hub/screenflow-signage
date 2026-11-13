-- Screenflow v15: daily repeated campaigns and preloading future content for offline TV.
alter table public.smart_items
 add column if not exists daily_start time without time zone,
 add column if not exists daily_end time without time zone,
 add column if not exists weekdays smallint[] not null default ARRAY[1,2,3,4,5,6,7]::smallint[];
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
    'body',i.body,'author_handle',i.author_handle,
    'interactive_event_id',i.interactive_event_id,
    'daily_start',to_char(i.daily_start,'HH24:MI'),
    'daily_end',to_char(i.daily_end,'HH24:MI'),
    'weekdays',i.weekdays,
    'starts_at',i.starts_at,'ends_at',i.ends_at,
    'interactive_state',case when i.interactive_event_id is not null
      then public.interactive_event_state(i.interactive_event_id) else null end,'post_url',i.post_url,
    'duration_seconds',i.duration_seconds,
    'storage_path',a.storage_path,'kind',a.kind,
    'blur_background_path',a.blur_background_path
   ) order by i.sort_order,i.created_at)
   from public.smart_items i
   left join public.assets a on a.id=i.asset_id and a.enabled
   where i.location_id=l.id and i.enabled=true
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
