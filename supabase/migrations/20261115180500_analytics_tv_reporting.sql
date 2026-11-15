create or replace function public.get_screenflow_analytics_report(p_days integer default 7,p_location_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare d int := least(90,greatest(1,coalesce(p_days,7)));
begin
  if not public.is_signage_admin() then raise exception 'Not authorized';end if;
  return jsonb_build_object(
    'days',d,'generated_at',now(),
    'web_events',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.report_date,t.location_id,t.event_name) from (
        select (a.occurred_at at time zone 'Europe/Bucharest')::date as report_date,
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
    'tv_media',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.count desc) from (
        select s.location_id,e.asset_id,coalesce(a.title,'Material') title,e.event_name,
          count(*)::int count,round(coalesce(sum(e.duration_ms),0)/1000.0)::int seconds
        from public.screenflow_tv_media_events e
        join public.screens s on s.id=e.screen_id
        join public.assets a on a.id=e.asset_id
        where e.occurred_at>=now()-make_interval(days=>d)
          and (p_location_id is null or s.location_id=p_location_id)
        group by s.location_id,e.asset_id,a.title,e.event_name
        order by count desc limit 40
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
    'latest_staff_logins',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.occurred_at desc) from (
        select u.email,e.occurred_at from public.screenflow_staff_login_events e
        join auth.users u on u.id=e.user_id
        where e.occurred_at>=now()-make_interval(days=>d)
        order by e.occurred_at desc limit 15
      ) t),'[]'::jsonb),
    'account_requests_new',(select count(*)::int from public.screenflow_access_requests
       where requested_at>=now()-make_interval(days=>d)),
    'staff_logins',(select count(*)::int from public.screenflow_staff_login_events
       where occurred_at>=now()-make_interval(days=>d)),
    'pending_accounts',(select count(*)::int from public.screenflow_access_requests
       where status='pending')
  );
end $$;
