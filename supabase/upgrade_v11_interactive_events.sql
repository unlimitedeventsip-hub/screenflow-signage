-- Screenflow v11 interactive events: real votes/quiz and karaoke signups.
-- Write operations are performed only by a rate-limited Edge Function.
create table if not exists public.interactive_events(
 id uuid primary key default gen_random_uuid(),
 location_id uuid not null references public.locations(id) on delete cascade,
 kind text not null check (kind in ('vote','quiz','karaoke')),
 title text not null check (char_length(title) between 3 and 200),
 options jsonb not null default '[]'::jsonb,
 active boolean not null default true,
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz not null default now(),
 check (ends_at is null or starts_at is null or ends_at>starts_at)
);
create index if not exists interactive_events_location_idx on public.interactive_events(location_id,created_at desc);
create table if not exists public.interactive_votes(
 event_id uuid not null references public.interactive_events(id) on delete cascade,
 voter_hash text not null,
 option_index smallint not null,
 created_at timestamptz not null default now(),
 primary key (event_id,voter_hash)
);
create table if not exists public.karaoke_queue(
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.interactive_events(id) on delete cascade,
 participant_hash text not null,
 display_name text not null check(char_length(display_name) between 1 and 35),
 song_title text not null default '',
 position bigserial,
 status text not null default 'waiting' check(status in ('waiting','called','done','skipped')),
 created_at timestamptz not null default now(),
 unique(event_id,participant_hash)
);
create index if not exists karaoke_queue_event_idx on public.karaoke_queue(event_id,position);
alter table public.interactive_events enable row level security;
alter table public.interactive_votes enable row level security;
alter table public.karaoke_queue enable row level security;
drop policy if exists "interactive admin all" on public.interactive_events;
create policy "interactive admin all" on public.interactive_events for all to authenticated
 using(public.is_signage_admin()) with check(public.is_signage_admin());
drop policy if exists "karaoke admin all" on public.karaoke_queue;
create policy "karaoke admin all" on public.karaoke_queue for all to authenticated
 using(public.is_signage_admin()) with check(public.is_signage_admin());
revoke all on public.interactive_events,public.interactive_votes,public.karaoke_queue from anon,authenticated;
grant select,insert,update,delete on public.interactive_events to authenticated;
grant select,update,delete on public.karaoke_queue to authenticated;
-- Public requests use ONLY the explicitly redacted state function.
create or replace function public.interactive_event_state(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare e public.interactive_events%rowtype;
begin
 select * into e from public.interactive_events where id=p_event_id
  and active=true and (starts_at is null or starts_at<=now())
  and (ends_at is null or ends_at>now());
 if not found then return null; end if;
 return jsonb_build_object(
 'id',e.id,'title',e.title,'kind',e.kind,'options',e.options,
 'results',coalesce((select jsonb_agg(jsonb_build_object('index',n.idx,'votes',
    (select count(*) from public.interactive_votes v
     where v.event_id=e.id and v.option_index=n.idx)) order by n.idx)
    from generate_series(0,jsonb_array_length(e.options)-1) n(idx)),'[]'::jsonb),
 'karaoke',coalesce((select jsonb_agg(jsonb_build_object('name',q.display_name,
    'song',q.song_title,'status',q.status) order by q.position)
     from public.karaoke_queue q where q.event_id=e.id and q.status in ('waiting','called')),'[]'::jsonb)
 );
end;
$$;
revoke all on function public.interactive_event_state(uuid) from public;
grant execute on function public.interactive_event_state(uuid) to anon,authenticated,service_role;
