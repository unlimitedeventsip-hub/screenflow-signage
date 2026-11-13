-- Screenflow v14: read-only local control agent monitoring for authenticated admins.
create or replace function public.tv_control_agent_status()
returns table(location_id uuid,agent_id uuid,last_seen_at timestamptz,enabled boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_signage_admin() then raise exception 'Not authorized'; end if;
 return query select a.location_id,a.agent_id,a.last_seen_at,a.enabled
 from public.tv_control_agents a;
end;$$;
revoke all on function public.tv_control_agent_status() from public,anon;
grant execute on function public.tv_control_agent_status() to authenticated;
