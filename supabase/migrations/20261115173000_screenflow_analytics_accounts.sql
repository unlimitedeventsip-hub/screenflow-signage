-- ScreenFlow analytics v1: opt-in, minimal, anonymous guest measurements.
-- No IP, UA, email, search terms or raw personal information is recorded.
create table if not exists public.screenflow_analytics_events (
  id bigint generated always as identity primary key,
  hub_id uuid not null references public.guest_hubs(id) on delete cascade,
  session_id uuid not null,
  event_name text not null check(event_name in (
    'hub_view','menu_open','menu_search','menu_item_view','booking_open','booking_sent',
    'external_booking_click','tickets_click','social_click','event_open','quiz_view',
    'pwa_prompt','pwa_install','pwa_standalone')),
  source text not null default 'direct' check(source in ('direct','tv_qr','print_qr','shared','other')),
  item_id uuid references public.smart_items(id) on delete set null,
  event_id uuid references public.interactive_events(id) on delete set null,
  occurred_at timestamptz not null default now(),
  check(item_id is null or event_name='menu_item_view')
);
create index if not exists screenflow_analytics_period_idx on public.screenflow_analytics_events(occurred_at desc, hub_id);
create index if not exists screenflow_analytics_location_idx on public.screenflow_analytics_events(hub_id, event_name, occurred_at desc);
create index if not exists screenflow_analytics_session_idx on public.screenflow_analytics_events(session_id,occurred_at desc);
alter table public.screenflow_analytics_events enable row level security;
revoke all on public.screenflow_analytics_events from public,anon,authenticated;
grant all on public.screenflow_analytics_events to service_role;
revoke all on sequence public.screenflow_analytics_events_id_seq from public,anon,authenticated;
grant all on sequence public.screenflow_analytics_events_id_seq to service_role;

create table if not exists public.screenflow_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check(status in ('pending','approved')),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null
);
alter table public.screenflow_access_requests enable row level security;
revoke all on public.screenflow_access_requests from public,anon,authenticated;
grant all on public.screenflow_access_requests to service_role;

create table if not exists public.screenflow_staff_login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now()
);
create index if not exists screenflow_staff_login_period_idx on public.screenflow_staff_login_events(occurred_at desc);
alter table public.screenflow_staff_login_events enable row level security;
revoke all on public.screenflow_staff_login_events from public,anon,authenticated;
grant all on public.screenflow_staff_login_events to service_role;
revoke all on sequence public.screenflow_staff_login_events_id_seq from public,anon,authenticated;
grant all on sequence public.screenflow_staff_login_events_id_seq to service_role;

create or replace function public.log_screenflow_guest_event(
  p_slug text, p_event_name text, p_session_id uuid,
  p_source text default 'direct', p_item_id uuid default null, p_event_id uuid default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare h public.guest_hubs%rowtype;
begin
  if p_session_id is null or p_event_name is null or p_event_name not in (
    'hub_view','menu_open','menu_search','menu_item_view','booking_open','booking_sent',
    'external_booking_click','tickets_click','social_click','event_open','quiz_view',
    'pwa_prompt','pwa_install','pwa_standalone') then return false; end if;
  if p_source not in ('direct','tv_qr','print_qr','shared','other') then p_source:='direct'; end if;
  if p_slug is not null and p_slug <> '' then
    select * into h from public.guest_hubs where slug=p_slug and enabled;
  elsif p_event_id is not null then
    select gh.* into h from public.guest_hubs gh
      join public.interactive_events ie on ie.location_id=gh.location_id
      where ie.id=p_event_id and gh.enabled limit 1;
  end if;
  if h.id is null then return false; end if;
  if p_event_id is not null and not exists(
    select 1 from public.interactive_events where id=p_event_id and location_id=h.location_id
  ) then return false; end if;
  if p_event_name='menu_item_view' then
    if p_item_id is null or not exists(
      select 1 from public.smart_items where id=p_item_id and location_id=h.location_id and mode='menu' and guest_visible
    ) then return false; end if;
  else p_item_id:=null; end if;
  -- Soft abuse limiting. Client-side events are estimates, never billing-grade.
  if (select count(*) from public.screenflow_analytics_events
      where session_id=p_session_id and occurred_at>now()-interval '1 hour') >= 80
     or exists (select 1 from public.screenflow_analytics_events
      where session_id=p_session_id and hub_id=h.id and event_name=p_event_name
        and item_id is not distinct from p_item_id and event_id is not distinct from p_event_id
        and occurred_at > now() - case when p_event_name in ('hub_view','quiz_view','pwa_standalone')
                  then interval '15 minutes' else interval '10 seconds' end)
  then return false; end if;
  insert into public.screenflow_analytics_events(hub_id,session_id,event_name,source,item_id,event_id)
    values(h.id,p_session_id,p_event_name,p_source,p_item_id,p_event_id);
  return true;
end $$;
revoke all on function public.log_screenflow_guest_event(text,text,uuid,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.log_screenflow_guest_event(text,text,uuid,text,uuid,uuid) to anon,authenticated,service_role;

create or replace function public.request_screenflow_access()
returns text language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then return 'login_required'; end if;
  if public.is_signage_admin() then return 'already_approved'; end if;
  insert into public.screenflow_access_requests(user_id) values(auth.uid())
    on conflict(user_id) do nothing;
  return 'pending';
end $$;
revoke all on function public.request_screenflow_access() from public,anon,authenticated;
grant execute on function public.request_screenflow_access() to authenticated,service_role;

create or replace function public.list_screenflow_access_requests()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
  if not public.is_signage_admin() then raise exception 'Not authorized';end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id',r.user_id,'email',u.email,
      'requested_at',r.requested_at) order by r.requested_at)
      from public.screenflow_access_requests r join auth.users u on u.id=r.user_id
      where r.status='pending'),'[]'::jsonb);
end $$;
revoke all on function public.list_screenflow_access_requests() from public,anon,authenticated;
grant execute on function public.list_screenflow_access_requests() to authenticated,service_role;

create or replace function public.approve_screenflow_access(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if not public.is_signage_admin() then raise exception 'Not authorized';end if;
  if p_user_id is null or not exists(
    select 1 from public.screenflow_access_requests where user_id=p_user_id and status='pending'
  ) then return false;end if;
  -- Approval grants FULL ScreenFlow admin access: explicit elevated operation.
  insert into public.admin_users(user_id) values(p_user_id) on conflict(user_id) do nothing;
  update public.screenflow_access_requests
    set status='approved',approved_at=now(),approved_by=auth.uid()
    where user_id=p_user_id and status='pending';
  return true;
end $$;
revoke all on function public.approve_screenflow_access(uuid) from public,anon,authenticated;
grant execute on function public.approve_screenflow_access(uuid) to authenticated,service_role;

create or replace function public.log_screenflow_admin_login()
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null or not public.is_signage_admin() then return false; end if;
  insert into public.screenflow_staff_login_events(user_id) values(auth.uid());
  return true;
end $$;
revoke all on function public.log_screenflow_admin_login() from public,anon,authenticated;
grant execute on function public.log_screenflow_admin_login() to authenticated,service_role;

create or replace function public.get_screenflow_analytics_report(p_days integer default 7,p_location_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare d int := least(90,greatest(1,coalesce(p_days,7)));
begin
  if not public.is_signage_admin() then raise exception 'Not authorized';end if;
  return jsonb_build_object(
    'days',d,'generated_at',now(),
    'web_events',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.day,t.location_id,t.event_name) from (
        select (a.occurred_at at time zone 'Europe/Bucharest')::date day,
          h.location_id,a.event_name,a.source,count(*)::integer events,count(distinct a.session_id)::integer sessions
        from public.screenflow_analytics_events a
        join public.guest_hubs h on h.id=a.hub_id
        where a.occurred_at>=now()-make_interval(days=>d)
          and (p_location_id is null or h.location_id=p_location_id)
        group by 1,2,3,4
      ) t),'[]'::jsonb),
    'popular_items',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.opens desc) from (
        select a.item_id,h.location_id,coalesce(s.title,'Material') title,count(*)::int opens
        from public.screenflow_analytics_events a
        join public.guest_hubs h on h.id=a.hub_id
        left join public.smart_items s on s.id=a.item_id
        where a.event_name='menu_item_view' and a.occurred_at>=now()-make_interval(days=>d)
          and (p_location_id is null or h.location_id=p_location_id)
        group by a.item_id,h.location_id,s.title order by opens desc limit 20
      ) t),'[]'::jsonb),
    'tv_transitions',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.count desc) from (
        select s.location_id,e.asset_id,coalesce(a.title,'Material') title,
          count(*)::int count
        from public.tv_playback_events e
        join public.screens s on s.id=e.screen_id
        left join public.assets a on a.id=e.asset_id
        where e.occurred_at>=now()-make_interval(days=>d)
          and e.event_type='asset_changed' and e.playback_state='playing'
          and (p_location_id is null or s.location_id=p_location_id)
        group by s.location_id,e.asset_id,a.title order by count desc limit 30
      ) t),'[]'::jsonb),
    'tv_installations',coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select s.location_id,ti.platform,ti.client_type,
          count(*)::int installations,
          count(*) filter(where ti.first_seen_at>=now()-make_interval(days=>d))::int new_installations,
          count(*) filter(where ti.last_seen_at>now()-interval '45 seconds')::int online
        from public.tv_installations ti left join public.screens s on s.id=ti.screen_id
        where (p_location_id is null or s.location_id=p_location_id)
        group by s.location_id,ti.platform,ti.client_type
      ) t),'[]'::jsonb),
    'bookings',coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select h.location_id,r.status,count(*)::int count
        from public.guest_reservations r join public.guest_hubs h on h.id=r.hub_id
        where r.created_at>=now()-make_interval(days=>d)
          and (p_location_id is null or h.location_id=p_location_id)
        group by h.location_id,r.status
      ) t),'[]'::jsonb),
    'participation',coalesce((
      select jsonb_agg(to_jsonb(t)) from (
        select location_id,activity,sum(n)::int count from (
          select ie.location_id,'voturi' activity,count(*) n from public.interactive_votes v join public.interactive_events ie on ie.id=v.event_id
            where v.created_at>=now()-make_interval(days=>d) group by ie.location_id
          union all
          select ie.location_id,'quiz' activity,count(*) n from public.quiz_answers v join public.interactive_events ie on ie.id=v.event_id
            where v.created_at>=now()-make_interval(days=>d) group by ie.location_id
          union all
          select ie.location_id,'karaoke' activity,count(*) n from public.karaoke_queue v join public.interactive_events ie on ie.id=v.event_id
            where v.created_at>=now()-make_interval(days=>d) group by ie.location_id
        ) combined where p_location_id is null or location_id=p_location_id
        group by location_id,activity
      ) t),'[]'::jsonb),
    'staff_logins',(select count(*)::int from public.screenflow_staff_login_events
       where occurred_at>=now()-make_interval(days=>d)),
    'pending_accounts',(select count(*)::int from public.screenflow_access_requests
       where status='pending')
  );
end $$;
revoke all on function public.get_screenflow_analytics_report(integer,uuid) from public,anon,authenticated;
grant execute on function public.get_screenflow_analytics_report(integer,uuid) to authenticated,service_role;

comment on table public.screenflow_analytics_events is 'Opt-in guest analytics, no personal identifiers beyond ephemeral per-tab session UUID; metric counts are estimates, not precise QR scans.';
comment on table public.screenflow_access_requests is 'Self registration requires explicit FULL ADMIN approval before any ScreenFlow data access.';
