
-- Per-venue operations. Sensitive access/delivery tables are service-only.
alter table public.guest_hubs add column if not exists max_daily_requests int not null default 100 check(max_daily_requests between 1 and 500);
alter table public.guest_hubs add column if not exists max_slot_reservations int not null default 20 check(max_slot_reservations between 1 and 200);
alter table public.guest_hubs add column if not exists max_slot_guests int not null default 80 check(max_slot_guests between 1 and 1000);
alter table public.guest_hubs add column if not exists booking_duration_minutes int not null default 120 check(booking_duration_minutes between 30 and 480);
alter table public.smart_items add column if not exists category text not null default '' check(char_length(category)<=60);
create table public.reservation_tables (
 id uuid primary key default gen_random_uuid(), hub_id uuid not null references public.guest_hubs(id) on delete cascade,
 label text not null check(char_length(label) between 1 and 30), seats int not null check(seats between 1 and 50),
 zone text not null default '' check(char_length(zone)<=40), x int not null default 10 check(x between 0 and 90), y int not null default 10 check(y between 0 and 90),
 enabled boolean not null default true, unique(hub_id,label), unique(hub_id,id)
);
alter table public.guest_reservations add column if not exists email text not null default '' check(char_length(email)<=254);
alter table public.guest_reservations add column if not exists attendance text not null default 'unknown' check(attendance in ('unknown','arrived','no_show'));
alter table public.guest_reservations add column if not exists table_id uuid;
alter table public.guest_reservations add constraint reservation_table_venue_fk foreign key(hub_id,table_id) references public.reservation_tables(hub_id,id);
alter table public.guest_reservations add column if not exists response_note text not null default '' check(char_length(response_note)<=350);
alter table public.guest_reservations add column if not exists status_token uuid not null default gen_random_uuid() unique;
alter table public.guest_reservations add column if not exists version int not null default 1;
alter table public.guest_reservations add column if not exists duration_minutes int not null default 120;
create table public.reservation_managers (
 id uuid primary key default gen_random_uuid(),hub_id uuid not null references public.guest_hubs(id) on delete cascade,
 label text not null check(char_length(label) between 2 and 70), email text not null default '' check(char_length(email)<=254),
 secret_hash text not null unique, enabled boolean not null default true, expires_at timestamptz not null default now()+interval '90 days',created_at timestamptz not null default now()
);
create table public.reservation_push (
 id uuid primary key default gen_random_uuid(),hub_id uuid not null references public.guest_hubs(id) on delete cascade,
 manager_id uuid references public.reservation_managers(id) on delete cascade,
 subscription jsonb not null, endpoint text not null unique, created_at timestamptz not null default now()
);
create table public.reservation_delivery_config (
 id boolean primary key default true check(id), public_key text not null, private_key text not null,worker_key text not null
);
create table public.reservation_notifications (
 id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.guest_reservations(id) on delete cascade,
 hub_id uuid not null references public.guest_hubs(id) on delete cascade,kind text not null check(kind in ('new','confirmed','cancelled')),
 version int not null,channel text not null check(channel in ('push','email')), recipient text not null default '',
 status text not null default 'pending' check(status in ('pending','processing','sent','failed','blocked')),attempts int not null default 0,
 error text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(reservation_id,version,kind,channel,recipient)
);
create index reservation_notifications_pending_idx on public.reservation_notifications(status,updated_at);
create index reservation_managers_hub_idx on public.reservation_managers(hub_id);
create index reservation_push_hub_idx on public.reservation_push(hub_id);
create index guest_reservations_table_idx on public.guest_reservations(table_id,requested_at) where status='confirmed';
alter table public.reservation_tables enable row level security;
alter table public.reservation_managers enable row level security;
alter table public.reservation_push enable row level security;
alter table public.reservation_delivery_config enable row level security;
alter table public.reservation_notifications enable row level security;
revoke all on public.reservation_tables,public.reservation_managers,public.reservation_push,public.reservation_delivery_config,public.reservation_notifications from anon,authenticated;
grant all on public.reservation_tables,public.reservation_managers,public.reservation_push,public.reservation_delivery_config,public.reservation_notifications to service_role;
-- Eliminate direct status updates: all decisions pass the atomic capacity check.
drop policy "admin guest reservations" on public.guest_reservations;
create policy "admin read reservations" on public.guest_reservations for select to authenticated using((select public.is_signage_admin()));
revoke insert,update,delete on public.guest_reservations from authenticated;
create function public.enqueue_reservation_notifications(p_id uuid,p_kind text) returns void language plpgsql security invoker set search_path='' as $$
declare r public.guest_reservations%rowtype;
begin
 select * into r from public.guest_reservations where id=p_id;
 if p_kind='new' then
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel) values(r.id,r.hub_id,p_kind,r.version,'push') on conflict do nothing;
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel,recipient)
   select r.id,r.hub_id,p_kind,r.version,'email',m.email from public.reservation_managers m where m.hub_id=r.hub_id and m.enabled and m.expires_at>now() and m.email<>'' on conflict do nothing;
 elsif r.email<>'' then
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel,recipient) values(r.id,r.hub_id,p_kind,r.version,'email',r.email) on conflict do nothing;
 end if;
end $$;
drop function public.create_guest_reservation(uuid,text,text,text,text,text,int,text);
create function public.create_guest_reservation(p_hub_id uuid,p_request_id text,p_rate_hash text,p_name text,p_phone text,p_local_time text,p_guests int,p_note text,p_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare wanted timestamptz;r public.guest_reservations%rowtype;h public.guest_hubs%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_hub_id::text,0));
 select * into h from public.guest_hubs where id=p_hub_id and enabled and booking_enabled;
 if not found then return jsonb_build_object('error','Rezervările sunt închise pentru această locație.','status',409); end if;
 select * into r from public.guest_reservations where hub_id=p_hub_id and request_id=p_request_id;
 if found then return jsonb_build_object('reference',upper(left(r.id::text,8)),'token',r.status_token);end if;
 wanted:=p_local_time::timestamp at time zone 'Europe/Bucharest';
 if wanted<=now() or wanted>now()+interval '180 days' then return jsonb_build_object('error','Alege o dată viitoare în următoarele 180 de zile.','status',400);end if;
 if char_length(p_name)<2 or p_guests<1 or p_guests>30 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then return jsonb_build_object('error','Verifică datele de contact.','status',400);end if;
 if (select count(*) from public.guest_reservations where rate_hash=p_rate_hash and created_at>now()-interval '1 hour')>=5 then return jsonb_build_object('error','Prea multe cereri. Încearcă mai târziu.','status',429);end if;
 if (select count(*) from public.guest_reservations where hub_id=h.id and status<>'cancelled' and (requested_at at time zone 'Europe/Bucharest')::date=(wanted at time zone 'Europe/Bucharest')::date)>=h.max_daily_requests then return jsonb_build_object('error','Nu mai primim cereri online pentru această zi.','status',409);end if;
 if (select count(*) from public.guest_reservations where hub_id=h.id and status in ('pending','confirmed') and requested_at<wanted+make_interval(mins=>h.booking_duration_minutes) and requested_at+make_interval(mins=>duration_minutes)>wanted)>=h.max_slot_reservations or
 coalesce((select sum(guests) from public.guest_reservations where hub_id=h.id and status in ('pending','confirmed') and requested_at<wanted+make_interval(mins=>h.booking_duration_minutes) and requested_at+make_interval(mins=>duration_minutes)>wanted),0)+p_guests>h.max_slot_guests then return jsonb_build_object('error','Intervalul este ocupat. Alege altă oră.','status',409);end if;
 insert into public.guest_reservations(hub_id,request_id,rate_hash,guest_name,phone,email,requested_at,guests,note,duration_minutes) values(h.id,p_request_id,p_rate_hash,p_name,p_phone,lower(p_email),wanted,p_guests,p_note,h.booking_duration_minutes) returning * into r;
 perform public.enqueue_reservation_notifications(r.id,'new');
 return jsonb_build_object('reference',upper(left(r.id::text,8)),'token',r.status_token);
end $$;
create function public.decide_guest_reservation(p_hub_id uuid,p_id uuid,p_version int,p_status text,p_attendance text,p_table uuid,p_note text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.guest_reservations%rowtype;h public.guest_hubs%rowtype;t public.reservation_tables%rowtype;changed boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_hub_id::text,0));
 select * into r from public.guest_reservations where id=p_id and hub_id=p_hub_id for update;
 if not found then return jsonb_build_object('error','Cerere inexistentă.','status',404);end if;
 if r.version<>p_version then return jsonb_build_object('error','Cererea a fost schimbată de un coleg. Actualizează lista.','status',409);end if;
 if p_status not in ('pending','confirmed','cancelled') or p_attendance not in ('unknown','arrived','no_show') or char_length(p_note)>350 or (p_attendance<>'unknown' and p_status<>'confirmed') then return jsonb_build_object('error','Stare invalidă. Confirmă mai întâi rezervarea.','status',400);end if;
 select * into h from public.guest_hubs where id=p_hub_id;
 if p_status='confirmed' then
  if (select count(*) from public.guest_reservations where hub_id=h.id and id<>r.id and status='confirmed' and requested_at<r.requested_at+make_interval(mins=>r.duration_minutes) and requested_at+make_interval(mins=>duration_minutes)>r.requested_at)>=h.max_slot_reservations or
    coalesce((select sum(guests) from public.guest_reservations where hub_id=h.id and id<>r.id and status='confirmed' and requested_at<r.requested_at+make_interval(mins=>r.duration_minutes) and requested_at+make_interval(mins=>duration_minutes)>r.requested_at),0)+r.guests>h.max_slot_guests then return jsonb_build_object('error','Capacitatea intervalului a fost atinsă.','status',409);end if;
 end if;
 if p_table is not null then
  select * into t from public.reservation_tables where id=p_table and hub_id=h.id and enabled;
  if not found or t.seats<r.guests then return jsonb_build_object('error','Masa nu are suficiente locuri.','status',409);end if;
  if p_status='confirmed' and exists(select 1 from public.guest_reservations where id<>r.id and table_id=p_table and status='confirmed' and requested_at<r.requested_at+make_interval(mins=>r.duration_minutes) and requested_at+make_interval(mins=>duration_minutes)>r.requested_at) then return jsonb_build_object('error','Masa este deja rezervată în acest interval.','status',409);end if;
 end if;
 changed:=r.status<>p_status;
 update public.guest_reservations set status=p_status,attendance=p_attendance,table_id=p_table,response_note=p_note,version=version+1 where id=r.id returning * into r;
 if changed and p_status in ('confirmed','cancelled') then perform public.enqueue_reservation_notifications(r.id,p_status);end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.claim_reservation_notifications() returns setof public.reservation_notifications language sql security invoker set search_path='' as $$
 update public.reservation_notifications set status='processing',attempts=attempts+1,updated_at=now() where id in
  (select id from public.reservation_notifications where (status in ('pending','failed') or (status='processing' and updated_at<now()-interval '5 minutes')) and attempts<8 and (attempts=0 or updated_at<now()-interval '5 minutes') order by created_at for update skip locked limit 20) returning *;
$$;
revoke all on function public.enqueue_reservation_notifications(uuid,text),public.create_guest_reservation(uuid,text,text,text,text,text,int,text,text),public.decide_guest_reservation(uuid,uuid,int,text,text,uuid,text),public.claim_reservation_notifications() from public,anon,authenticated;
grant execute on function public.enqueue_reservation_notifications(uuid,text),public.create_guest_reservation(uuid,text,text,text,text,text,int,text,text),public.decide_guest_reservation(uuid,uuid,int,text,text,uuid,text),public.claim_reservation_notifications() to service_role;


create table public.quiz_games (
 event_id uuid primary key references public.interactive_events(id) on delete cascade,
 questions jsonb not null check(jsonb_typeof(questions)='array' and jsonb_array_length(questions) between 1 and 40),
 stage text not null default 'waiting' check(stage in ('waiting','question','reveal','finished')),
 question_index int not null default 0,round_started_at timestamptz,version int not null default 1
);
create table public.quiz_players (
 event_id uuid not null references public.interactive_events(id) on delete cascade,participant_hash text not null,
 name text not null check(char_length(name) between 2 and 35),primary key(event_id,participant_hash)
);
create table public.quiz_answers (
 event_id uuid not null,participant_hash text not null,question_index int not null,choice int not null,points int not null,
 created_at timestamptz not null default now(),primary key(event_id,participant_hash,question_index),
 foreign key(event_id,participant_hash) references public.quiz_players(event_id,participant_hash) on delete cascade
);
alter table public.quiz_games enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_games,public.quiz_players,public.quiz_answers from anon,authenticated;
grant all on public.quiz_games,public.quiz_players,public.quiz_answers to service_role;
grant select on public.quiz_games to authenticated;
create policy "admin quiz games" on public.quiz_games for select to authenticated using((select public.is_signage_admin()));
create function public.create_quiz_game(p_location_id uuid,p_title text,p_questions jsonb,p_origin text) returns uuid language plpgsql security invoker set search_path='' as $$
declare event uuid;
begin
 insert into public.interactive_events(location_id,kind,title,options) values(p_location_id,'quiz',p_title,'[]') returning id into event;
 insert into public.quiz_games(event_id,questions) values(event,p_questions);
 insert into public.smart_items(location_id,mode,title,subtitle,body,interactive_event_id,post_url,duration_seconds)
  values(p_location_id,'vote',p_title,'Scanează QR și intră în quiz','Runde live · puncte · clasament',event,p_origin||'/join/'||event::text,3600);
 update public.locations set display_mode='vote' where id=p_location_id;
 return event;
end $$;
create function public.quiz_control(p_event_id uuid,p_command text,p_version int) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.quiz_games%rowtype;
begin
 select * into g from public.quiz_games where event_id=p_event_id for update;
 if not found then return jsonb_build_object('error','Quiz inexistent.','status',404);end if;
 if g.version<>p_version then return jsonb_build_object('error','Runda a fost schimbată. Actualizează pagina.','status',409);end if;
 if p_command='start' and g.stage='waiting' then update public.quiz_games set stage='question',round_started_at=now(),version=version+1 where event_id=p_event_id;
 elsif p_command='reveal' and g.stage='question' then update public.quiz_games set stage='reveal',version=version+1 where event_id=p_event_id;
 elsif p_command='next' and g.stage='reveal' then
  update public.quiz_games set question_index=case when question_index+1<jsonb_array_length(questions) then question_index+1 else question_index end,
   stage=case when question_index+1<jsonb_array_length(questions) then 'question' else 'finished' end,round_started_at=now(),version=version+1 where event_id=p_event_id;
 elsif p_command='finish' then update public.quiz_games set stage='finished',version=version+1 where event_id=p_event_id;
 else return jsonb_build_object('error','Comanda nu este disponibilă în această rundă.','status',409);
 end if;
 return jsonb_build_object('ok',true);
end $$;
create function public.quiz_participate(p_event_id uuid,p_hash text,p_action text,p_name text,p_index int,p_choice int) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.quiz_games%rowtype;q jsonb;score int;
begin
 select * into g from public.quiz_games where event_id=p_event_id for share;
 if not found or not exists(select 1 from public.interactive_events where id=p_event_id and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now())) then return jsonb_build_object('error','Quiz indisponibil.','status',404);end if;
 if p_action='join' then
  if char_length(p_name) not between 2 and 35 then return jsonb_build_object('error','Introdu un nume între 2 și 35 de caractere.','status',400);end if;
  if (select count(*) from public.quiz_players where event_id=p_event_id)>=500 then return jsonb_build_object('error','Quizul este plin.','status',409);end if;
  insert into public.quiz_players values(p_event_id,p_hash,p_name) on conflict do nothing;
  return jsonb_build_object('ok',true);
 end if;
 if not exists(select 1 from public.quiz_players where event_id=p_event_id and participant_hash=p_hash) then return jsonb_build_object('error','Intră mai întâi în quiz.','status',403);end if;
 q=g.questions->g.question_index;
 if g.stage<>'question' or p_index<>g.question_index or now()>=g.round_started_at+make_interval(secs=>(q->>'seconds')::int) then return jsonb_build_object('error','Timpul acestei întrebări s-a încheiat.','status',409);end if;
 if p_choice<0 or p_choice>=jsonb_array_length(q->'options') then return jsonb_build_object('error','Variantă invalidă.','status',400);end if;
 score=case when p_choice=(q->>'correct')::int then greatest(500,1000-floor(extract(epoch from now()-g.round_started_at)*500/(q->>'seconds')::int)::int) else 0 end;
 insert into public.quiz_answers values(p_event_id,p_hash,p_index,p_choice,score,now()) on conflict do nothing;
 -- Correctness and score stay hidden until the reveal stage.
 return jsonb_build_object('ok',true);
end $$;
-- Preserve the old vote/karaoke implementation as an internal helper.
alter function public.interactive_event_state(uuid) rename to interactive_poll_state;
revoke all on function public.interactive_poll_state(uuid) from public,anon,authenticated;
grant execute on function public.interactive_poll_state(uuid) to service_role;
create function public.interactive_event_state(p_event_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare g public.quiz_games%rowtype;e public.interactive_events%rowtype;q jsonb;board jsonb;
begin
 select * into g from public.quiz_games where event_id=p_event_id;
 if not found then return public.interactive_poll_state(p_event_id);end if;
 select * into e from public.interactive_events where id=p_event_id and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());
 if not found then return null;end if;
 q=g.questions->g.question_index;
 select coalesce(jsonb_agg(row_to_json(b)),'[]') into board from (
  select p.name,coalesce(sum(a.points),0)::int as points from public.quiz_players p left join public.quiz_answers a on a.event_id=p.event_id and a.participant_hash=p.participant_hash
   and (a.question_index<g.question_index or g.stage in ('reveal','finished')) where p.event_id=p_event_id group by p.participant_hash,p.name order by points desc,p.name limit 10)b;
 return jsonb_build_object('id',e.id,'title',e.title,'kind','quiz','stage',g.stage,'version',g.version,'question_index',g.question_index,'total',jsonb_array_length(g.questions),
  'server_time',now(),'deadline',g.round_started_at+make_interval(secs=>(q->>'seconds')::int),
  'question',case when g.stage in ('question','reveal') then jsonb_build_object('text',q->>'text','options',q->'options') else null end,
  'correct',case when g.stage='reveal' then q->'correct' else null end,'explanation',case when g.stage='reveal' then q->>'explanation' else null end,
  'players',(select count(*) from public.quiz_players where event_id=p_event_id),'answers',(select count(*) from public.quiz_answers where event_id=p_event_id and question_index=g.question_index),'leaderboard',board);
end $$;
revoke all on function public.interactive_event_state(uuid) from public;
grant execute on function public.interactive_event_state(uuid) to anon,authenticated,service_role;
revoke all on function public.create_quiz_game(uuid,text,jsonb,text),public.quiz_control(uuid,text,int),public.quiz_participate(uuid,text,text,text,int,int) from public,anon,authenticated;
grant execute on function public.create_quiz_game(uuid,text,jsonb,text),public.quiz_control(uuid,text,int),public.quiz_participate(uuid,text,text,text,int,int) to service_role;

select cron.schedule('screenflow-reservation-notifications','* * * * *',$cron$
 select net.http_post(
  url:='https://asixkabhesmhbqunxqby.supabase.co/functions/v1/screenflow-reservations',
  headers:=jsonb_build_object('Content-Type','application/json','x-worker-key',worker_key),
  body:='{"action":"dispatch"}'::jsonb,
  timeout_milliseconds:=50000
 ) from public.reservation_delivery_config where id=true;
$cron$);
