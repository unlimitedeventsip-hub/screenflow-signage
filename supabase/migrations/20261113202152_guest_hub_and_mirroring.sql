-- Guest-facing content is explicitly published. Existing TV-only drafts stay private.
alter table public.smart_items add column if not exists guest_visible boolean not null default false;
create table public.guest_hubs (
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null unique references public.locations(id) on delete cascade,
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
 title text not null default '' check(char_length(title)<=100),
 description text not null default 'Mese cu prietenii, seri de povestit și momente #altfel.' check(char_length(description)<=400),
 enabled boolean not null default true,
 qr_on_tv boolean not null default false,
 booking_enabled boolean not null default true,
 booking_url text not null default '' check(booking_url='' or booking_url ~ '^https://'),
 menu_url text not null default '' check(menu_url='' or menu_url ~ '^https://'),
 tickets_url text not null default '' check(tickets_url='' or tickets_url ~ '^https://'),
 instagram_url text not null default '' check(instagram_url='' or instagram_url ~ '^https://'),
 facebook_url text not null default '' check(facebook_url='' or facebook_url ~ '^https://'),
 tiktok_url text not null default '' check(tiktok_url='' or tiktok_url ~ '^https://'),
 maps_url text not null default '' check(maps_url='' or maps_url ~ '^https://'),
 created_at timestamptz not null default now()
);
create table public.guest_reservations (
 id uuid primary key default gen_random_uuid(),
 hub_id uuid not null references public.guest_hubs(id) on delete cascade,
 request_id text not null check(char_length(request_id) between 20 and 80),
 rate_hash text not null check(char_length(rate_hash)=64),
 guest_name text not null check(char_length(guest_name) between 2 and 70),
 phone text not null check(char_length(phone) between 7 and 25),
 requested_at timestamptz not null,
 guests int not null check(guests between 1 and 30),
 note text not null default '' check(char_length(note)<=350),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(hub_id,request_id)
);
create index guest_reservations_hub_date_idx on public.guest_reservations(hub_id,requested_at);
create index guest_reservations_rate_idx on public.guest_reservations(rate_hash,created_at);
create table public.screen_mirror_sessions (
 id uuid primary key default gen_random_uuid(),
 screen_id uuid not null references public.screens(id) on delete cascade,
 created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
 offer jsonb not null check(offer->>'type'='offer' and char_length(offer->>'sdp') between 1 and 90000),
 answer jsonb check(answer is null or (answer->>'type'='answer' and char_length(answer->>'sdp') between 1 and 90000)),
 status text not null default 'waiting' check(status in ('waiting','connecting','playing','ended','failed','unsupported')),
 error_message text not null default '' check(char_length(error_message)<=250),
 receiver_seen_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '45 seconds',
 check(expires_at<=created_at+interval '4 hours')
);
create index screen_mirror_active_idx on public.screen_mirror_sessions(screen_id,created_at desc) where status in ('waiting','connecting','playing');
-- One active sender per television; older/expired sessions are ended before starting.
create unique index screen_mirror_one_active_idx on public.screen_mirror_sessions(screen_id) where status in ('waiting','connecting','playing');
alter table public.guest_hubs enable row level security;
alter table public.guest_reservations enable row level security;
alter table public.screen_mirror_sessions enable row level security;
create policy "admin guest hubs" on public.guest_hubs for all to authenticated using((select public.is_signage_admin())) with check((select public.is_signage_admin()));
create policy "admin guest reservations" on public.guest_reservations for all to authenticated using((select public.is_signage_admin())) with check((select public.is_signage_admin()));
create policy "admin mirror sessions" on public.screen_mirror_sessions for all to authenticated using((select public.is_signage_admin())) with check((select public.is_signage_admin()) and created_by=(select auth.uid()));
revoke all on public.guest_hubs,public.guest_reservations,public.screen_mirror_sessions from anon;
grant select,insert,update,delete on public.guest_hubs,public.guest_reservations,public.screen_mirror_sessions to authenticated;
grant all on public.guest_hubs,public.guest_reservations,public.screen_mirror_sessions to service_role;
-- Atomic, service-only booking submission. No public direct table writes.
create function public.create_guest_reservation(p_hub_id uuid,p_request_id text,p_rate_hash text,p_name text,p_phone text,p_local_time text,p_guests int,p_note text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare wanted timestamptz; existing uuid; reference_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_rate_hash,0));
 if not exists(select 1 from public.guest_hubs where id=p_hub_id and enabled and booking_enabled) then return jsonb_build_object('error','Rezervările nu sunt active.','status',409); end if;
 select id into existing from public.guest_reservations where hub_id=p_hub_id and request_id=p_request_id;
 if existing is not null then return jsonb_build_object('reference',upper(left(existing::text,8))); end if;
 wanted:=p_local_time::timestamp at time zone 'Europe/Bucharest';
 if wanted<=now() or wanted>now()+interval '180 days' then return jsonb_build_object('error','Alege o dată viitoare în următoarele 180 de zile.','status',400); end if;
 if (select count(*) from public.guest_reservations where rate_hash=p_rate_hash and created_at>now()-interval '1 hour')>=5 then return jsonb_build_object('error','Ai trimis deja mai multe cereri. Încearcă mai târziu.','status',429); end if;
 insert into public.guest_reservations(hub_id,request_id,rate_hash,guest_name,phone,requested_at,guests,note) values(p_hub_id,p_request_id,p_rate_hash,p_name,p_phone,wanted,p_guests,p_note) returning id into reference_id;
 return jsonb_build_object('reference',upper(left(reference_id::text,8)));
end $$;
revoke all on function public.create_guest_reservation(uuid,text,text,text,text,text,int,text) from public,anon,authenticated;
grant execute on function public.create_guest_reservation(uuid,text,text,text,text,text,int,text) to service_role;
-- Slugs are derived from live locations; no hardcoded IDs and no invented links.
insert into public.guest_hubs(location_id,slug,title)
 select id,trim(both '-' from regexp_replace(lower(name),'[^a-z0-9]+','-','g')),name from public.locations
 on conflict(location_id) do nothing;
comment on table public.guest_reservations is 'Private booking requests; contact the guest before marking confirmed. Delete obsolete personal data from Admin.';
