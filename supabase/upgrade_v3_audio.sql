-- Screenflow Audio: video sound and background music per playlist.
-- Additive migration for the EXISTING "screen" Supabase project.
-- Uses the existing public "ads" Storage bucket; audio files live under audio/.
create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  storage_path text not null unique check (storage_path like 'audio/%'),
  created_at timestamptz not null default now()
);

alter table public.audio_tracks enable row level security;
drop policy if exists "signage admin audio tracks" on public.audio_tracks;
create policy "signage admin audio tracks" on public.audio_tracks
  for all to authenticated
  using (public.is_signage_admin())
  with check (public.is_signage_admin());
revoke all on public.audio_tracks from anon;
grant select,insert,update,delete on public.audio_tracks to authenticated;

alter table public.playlists add column if not exists video_audio_enabled boolean not null default false;
alter table public.playlists add column if not exists video_volume integer not null default 35 check (video_volume between 0 and 100);
alter table public.playlists add column if not exists background_audio_enabled boolean not null default false;
alter table public.playlists add column if not exists background_volume integer not null default 25 check (background_volume between 0 and 100);
alter table public.playlists add column if not exists background_track_id uuid references public.audio_tracks(id) on delete set null;

-- TVs only receive public media paths and safe playlist audio settings;
-- administrative audio track records remain protected by RLS.
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
  'items', coalesce((select jsonb_agg(jsonb_build_object(
   'id', a.id, 'title', a.title, 'kind', a.kind, 'storage_path', a.storage_path,
   'duration_seconds', coalesce(pi.duration_override, a.duration_seconds)
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
