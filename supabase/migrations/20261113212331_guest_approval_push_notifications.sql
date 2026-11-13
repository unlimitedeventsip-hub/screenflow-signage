create table public.reservation_guest_push (
 id uuid primary key default gen_random_uuid(),reservation_id uuid not null references public.guest_reservations(id) on delete cascade,
 subscription jsonb not null,endpoint text not null,created_at timestamptz not null default now(),unique(reservation_id,endpoint)
);
alter table public.reservation_guest_push enable row level security;
revoke all on public.reservation_guest_push from public,anon,authenticated;
grant all on public.reservation_guest_push to service_role;
create or replace function public.enqueue_reservation_notifications(p_id uuid,p_kind text) returns void language plpgsql security invoker set search_path='' as $$
declare r public.guest_reservations%rowtype;
begin
 select * into r from public.guest_reservations where id=p_id;
 if p_kind='new' then
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel) values(r.id,r.hub_id,p_kind,r.version,'push') on conflict do nothing;
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel,recipient)
   select r.id,r.hub_id,p_kind,r.version,'email',m.email from public.reservation_managers m where m.hub_id=r.hub_id and m.enabled and m.expires_at>now() and m.email<>'' on conflict do nothing;
 else
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel,recipient) values(r.id,r.hub_id,p_kind,r.version,'push','guest') on conflict do nothing;
  if r.email<>'' then
  insert into public.reservation_notifications(reservation_id,hub_id,kind,version,channel,recipient) values(r.id,r.hub_id,p_kind,r.version,'email',r.email) on conflict do nothing;
  end if;
 end if;
end $$;
