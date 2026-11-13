-- Screenflow v13: remote physical TV control through a paired local agent.
-- Safe: zero commands are executed until an agent is manually paired and running.
create table if not exists public.tv_device_controls(
 screen_id uuid primary key references public.screens(id) on delete cascade,
 control_ip text not null default '',
 control_mac text not null default '',
 control_type text not null default 'android_adb' check(control_type in ('android_adb','wol_only','samsung_remote')),
 enabled boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.tv_control_agents(
 agent_id uuid primary key default gen_random_uuid(),
 location_id uuid not null unique references public.locations(id) on delete cascade,
 secret_hash text not null,
 enabled boolean not null default true,
 last_seen_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.tv_remote_commands(
 id uuid primary key default gen_random_uuid(),
 screen_id uuid not null references public.screens(id) on delete cascade,
 action text not null check(action in ('wake','launch','standby','reload')),
 status text not null default 'queued' check(status in ('queued','in_progress','done','failed')),
 created_at timestamptz not null default now(),
 picked_at timestamptz,
 finished_at timestamptz,
 result_message text not null default ''
);
create index if not exists tv_remote_commands_status_idx on public.tv_remote_commands(status,created_at);
alter table public.tv_device_controls enable row level security;
alter table public.tv_control_agents enable row level security;
alter table public.tv_remote_commands enable row level security;
drop policy if exists "tv controls admin" on public.tv_device_controls;
create policy "tv controls admin" on public.tv_device_controls for all to authenticated
 using(public.is_signage_admin()) with check(public.is_signage_admin());
drop policy if exists "tv commands admin" on public.tv_remote_commands;
create policy "tv commands admin" on public.tv_remote_commands for all to authenticated
 using(public.is_signage_admin()) with check(public.is_signage_admin());
revoke all on public.tv_control_agents from anon,authenticated;
grant select,insert,update,delete on public.tv_device_controls,public.tv_remote_commands to authenticated;

-- Pairing secret is generated server-side and returned ONCE to authenticated admin.
create or replace function public.pair_tv_control_agent(p_location_id uuid)
returns jsonb language plpgsql security definer volatile set search_path='' as $$
declare v_secret text;v_id uuid;
begin
 if not public.is_signage_admin() then raise exception 'Not authorized'; end if;
 if not exists(select 1 from public.locations where id=p_location_id) then raise exception 'Unknown location'; end if;
 v_secret:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.tv_control_agents(location_id,secret_hash)
 values(p_location_id,encode(extensions.digest(convert_to(v_secret,'UTF8'),'sha256'),'hex'))
 on conflict(location_id) do update set secret_hash=excluded.secret_hash,enabled=true
 returning agent_id into v_id;
 return jsonb_build_object('agent_id',v_id,'secret',v_secret);
end;
$$;
revoke all on function public.pair_tv_control_agent(uuid) from public,anon;
grant execute on function public.pair_tv_control_agent(uuid) to authenticated;

-- A paired agent sees only devices and commands of its own location.
create or replace function public.poll_tv_control_agent(p_agent_id uuid,p_secret text)
returns jsonb language plpgsql security definer volatile set search_path='' as $$
declare a public.tv_control_agents%rowtype; result jsonb;
begin
 select * into a from public.tv_control_agents where agent_id=p_agent_id and enabled=true;
 if not found or p_secret is null or length(p_secret)<>64 or
   encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex')<>a.secret_hash
   then raise exception 'Invalid control agent'; end if;
 update public.tv_control_agents set last_seen_at=now() where agent_id=p_agent_id;
 update public.tv_remote_commands c set status='in_progress',picked_at=now()
 where c.id in (
   select cmd.id from public.tv_remote_commands cmd
   join public.screens s on s.id=cmd.screen_id
   where s.location_id=a.location_id and cmd.status='queued'
     and cmd.created_at>now()-interval '10 minutes'
   order by cmd.created_at limit 15 for update of cmd skip locked
 );
 select jsonb_build_object(
 'location_id',l.id,'open_time',to_char(l.open_time,'HH24:MI'),
 'close_time',to_char(l.close_time,'HH24:MI'),
 'schedule_enabled',l.schedule_enabled,
 'devices',coalesce((
   select jsonb_agg(jsonb_build_object(
    'screen_id',s.id,'name',s.name,'ip',d.control_ip,'mac',d.control_mac,
    'type',d.control_type))
   from public.tv_device_controls d
   join public.screens s on s.id=d.screen_id
   where s.location_id=a.location_id and d.enabled=true
 ),'[]'::jsonb),
 'commands',coalesce((
   select jsonb_agg(jsonb_build_object('id',cmd.id,'screen_id',cmd.screen_id,
    'action',cmd.action,'created_at',cmd.created_at) order by cmd.created_at)
   from public.tv_remote_commands cmd
   join public.screens s on s.id=cmd.screen_id
   where s.location_id=a.location_id and cmd.status='in_progress'
    and cmd.picked_at>now()-interval '2 minutes'
 ),'[]'::jsonb)
 ) into result from public.locations l where l.id=a.location_id;
 return result;
end;
$$;
revoke all on function public.poll_tv_control_agent(uuid,text) from public;
grant execute on function public.poll_tv_control_agent(uuid,text) to anon,authenticated;

create or replace function public.ack_tv_control_agent(
 p_agent_id uuid,p_secret text,p_command_id uuid,p_ok boolean,p_result text default ''
) returns boolean language plpgsql security definer volatile set search_path='' as $$
declare a public.tv_control_agents%rowtype;
begin
 select * into a from public.tv_control_agents where agent_id=p_agent_id and enabled=true;
 if not found or p_secret is null or length(p_secret)<>64 or
  encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex')<>a.secret_hash
  then return false; end if;
 update public.tv_remote_commands cmd set
  status=case when p_ok then 'done' else 'failed' end,finished_at=now(),
  result_message=left(coalesce(p_result,''),180)
 from public.screens s where s.id=cmd.screen_id
  and s.location_id=a.location_id and cmd.id=p_command_id and cmd.status='in_progress';
 return found;
end;
$$;
revoke all on function public.ack_tv_control_agent(uuid,text,uuid,boolean,text) from public;
grant execute on function public.ack_tv_control_agent(uuid,text,uuid,boolean,text) to anon,authenticated;
