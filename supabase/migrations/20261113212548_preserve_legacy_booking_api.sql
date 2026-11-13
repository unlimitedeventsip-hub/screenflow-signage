-- Keep existing deployed clients operational while v2 is reviewed/published.
-- Only the service-only legacy overload can omit email. The v2 Edge API
-- independently validates and requires email before calling the database.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.create_guest_reservation(uuid,text,text,text,text,text,int,text,text)'::regprocedure) into definition;
 if position('or p_email !~' in definition)=0 then raise exception 'Unexpected reservation function definition';end if;
 definition:=replace(definition,'or p_email !~','or p_email is not null and p_email !~');
 definition:=replace(definition,'lower(p_email)','lower(coalesce(p_email,''''))');
 execute definition;
end $$;
create function public.create_guest_reservation(p_hub_id uuid,p_request_id text,p_rate_hash text,p_name text,p_phone text,p_local_time text,p_guests int,p_note text)
returns jsonb language sql security invoker set search_path='' as $$
 select public.create_guest_reservation(p_hub_id,p_request_id,p_rate_hash,p_name,p_phone,p_local_time,p_guests,p_note,null::text);
$$;
revoke all on function public.create_guest_reservation(uuid,text,text,text,text,text,int,text) from public,anon,authenticated;
grant execute on function public.create_guest_reservation(uuid,text,text,text,text,text,int,text) to service_role;
