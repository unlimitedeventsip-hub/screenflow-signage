-- Screenflow: run in Supabase SQL Editor on a NEW project.
-- IMPORTANT: create a Storage bucket named ads, PUBLIC, before using the app.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 150),
  storage_path text not null unique,
  kind text not null check (kind in ('image','video')),
  duration_seconds int not null default 10 check (duration_seconds between 3 and 3600),
  enabled boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  constraint valid_dates check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  position int not null default 0,
  duration_override int check (duration_override is null or duration_override between 3 and 3600),
  created_at timestamptz not null default now()
);
create index if not exists playlist_items_order_idx on public.playlist_items (playlist_id, position);
create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  public_id uuid not null unique default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  location_id uuid references public.locations(id) on delete set null,
  playlist_id uuid references public.playlists(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.is_signage_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users where user_id = auth.uid()); $$;

alter table public.admin_users enable row level security;
alter table public.locations enable row level security;
alter table public.playlists enable row level security;
alter table public.assets enable row level security;
alter table public.playlist_items enable row level security;
alter table public.screens enable row level security;

-- Admin users are provisioned manually via SQL, never from the public browser.
drop policy if exists "read self" on public.admin_users;
create policy "read self" on public.admin_users for select to authenticated using (user_id = auth.uid());

drop policy if exists "admin locations" on public.locations;
create policy "admin locations" on public.locations for all to authenticated using (public.is_signage_admin()) with check (public.is_signage_admin());
drop policy if exists "admin playlists" on public.playlists;
create policy "admin playlists" on public.playlists for all to authenticated using (public.is_signage_admin()) with check (public.is_signage_admin());
drop policy if exists "admin assets" on public.assets;
create policy "admin assets" on public.assets for all to authenticated using (public.is_signage_admin()) with check (public.is_signage_admin());
drop policy if exists "admin playlist items" on public.playlist_items;
create policy "admin playlist items" on public.playlist_items for all to authenticated using (public.is_signage_admin()) with check (public.is_signage_admin());
drop policy if exists "admin screens" on public.screens;
create policy "admin screens" on public.screens for all to authenticated using (public.is_signage_admin()) with check (public.is_signage_admin());

-- TV uses a random, hard-to-guess public_id. It can read only its own
-- filtered advertising manifest, not admin tables or other screens.
create or replace function public.get_screen_manifest(screen_public_id uuid)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select case when s.id is null then null else jsonb_build_object(
    'name', s.name,
    'location', coalesce(l.name, ''),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id,
        'title', a.title,
        'kind', a.kind,
        'storage_path', a.storage_path,
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
  where s.public_id = screen_public_id
  limit 1;
$$;

revoke all on function public.is_signage_admin() from public, anon;
grant execute on function public.is_signage_admin() to authenticated;
revoke all on function public.get_screen_manifest(uuid) from public;
grant execute on function public.get_screen_manifest(uuid) to anon, authenticated;

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.locations, public.playlists, public.assets, public.playlist_items, public.screens to authenticated;

-- Storage must be a PUBLIC bucket named ads. Uploaded files are intentionally
-- public (they are ads). Upload/delete restricted to admin identities.
drop policy if exists "signage upload" on storage.objects;
create policy "signage upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ads' and public.is_signage_admin());
drop policy if exists "signage update" on storage.objects;
create policy "signage update" on storage.objects for update to authenticated
  using (bucket_id = 'ads' and public.is_signage_admin())
  with check (bucket_id = 'ads' and public.is_signage_admin());
drop policy if exists "signage delete" on storage.objects;
create policy "signage delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ads' and public.is_signage_admin());

-- AFTER creating an Auth user through Authentication > Users, run:
-- insert into public.admin_users(user_id) values ('YOUR_AUTH_USER_UUID');
