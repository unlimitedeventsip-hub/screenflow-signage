-- Screenflow v9: secure Instagram connections and automatic import catalog.
-- OAuth tokens are AES-GCM ciphertext in a service-only table; never readable by TV or admins' browsers.
create table if not exists public.instagram_connections(
  location_id uuid primary key references public.locations(id) on delete cascade,
  ig_user_id text not null,
  username text not null,
  token_ciphertext text not null,
  token_expires_at timestamptz not null,
  auto_publish boolean not null default true,
  enabled boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.instagram_connections enable row level security;
revoke all on public.instagram_connections from anon,authenticated;
create table if not exists public.instagram_oauth_states(
 state_hash text primary key,
 location_id uuid not null references public.locations(id) on delete cascade,
 admin_user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.instagram_oauth_states enable row level security;
revoke all on public.instagram_oauth_states from anon,authenticated;
create table if not exists public.instagram_media_imports(
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id) on delete cascade,
 instagram_media_id text not null,
 permalink text not null,
 asset_id uuid references public.assets(id) on delete set null,
 smart_item_id uuid references public.smart_items(id) on delete set null,
 source_timestamp timestamptz,
 imported_at timestamptz not null default now(),
 unique(location_id,instagram_media_id)
);
alter table public.instagram_media_imports enable row level security;
revoke all on public.instagram_media_imports from anon,authenticated;
create index if not exists instagram_media_imports_location_idx on public.instagram_media_imports(location_id,imported_at desc);
create or replace function public.instagram_connection_status()
returns table(location_id uuid,username text,connected boolean,enabled boolean,auto_publish boolean,
  token_expires_at timestamptz,last_synced_at timestamptz,last_error text,imported_count bigint)
language plpgsql security definer stable set search_path = '' as $$
begin
 if not public.is_signage_admin() then raise exception 'Not authorized'; end if;
 return query
 select c.location_id,c.username,true,c.enabled,c.auto_publish,c.token_expires_at,
 c.last_synced_at,c.last_error,
 (select count(*) from public.instagram_media_imports m where m.location_id=c.location_id)
 from public.instagram_connections c;
end;
$$;
revoke all on function public.instagram_connection_status() from public,anon;
grant execute on function public.instagram_connection_status() to authenticated;
