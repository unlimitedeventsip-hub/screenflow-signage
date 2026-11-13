-- Screenflow v16: verifiable per-TV playback history and diagnostics.
create table if not exists public.tv_playback_events(
 id bigint generated always as identity primary key,
 installation_id uuid not null,
 screen_id uuid references public.screens(id) on delete set null,
 event_type text not null check(event_type in ('connected','asset_changed','state_changed','error')),
 asset_id uuid references public.assets(id) on delete set null,
 playback_state text not null default '',
 error_message text not null default '',
 occurred_at timestamptz not null default now()
);
create index if not exists tv_playback_events_screen_idx on public.tv_playback_events(screen_id,occurred_at desc);
alter table public.tv_playback_events enable row level security;
drop policy if exists "playback events admins" on public.tv_playback_events;
create policy "playback events admins" on public.tv_playback_events for select to authenticated
 using(public.is_signage_admin());
grant select on public.tv_playback_events to authenticated;
create or replace function public.tv_playback_audit()
returns trigger language plpgsql security definer set search_path='' as $$
declare e text;
begin
 if TG_OP='INSERT' then e:='connected';
 elsif new.error_message is distinct from old.error_message and new.error_message<>'' then e:='error';
 elsif new.current_asset_id is distinct from old.current_asset_id then e:='asset_changed';
 elsif new.playback_state is distinct from old.playback_state then e:='state_changed';
 else return new;
 end if;
 insert into public.tv_playback_events(
  installation_id,screen_id,event_type,asset_id,playback_state,error_message
 ) values(new.installation_id,new.screen_id,e,new.current_asset_id,
   new.playback_state,left(new.error_message,140));
 return new;
end;
$$;
drop trigger if exists screenflow_tv_playback_audit on public.tv_installations;
create trigger screenflow_tv_playback_audit after insert or update
 on public.tv_installations for each row execute function public.tv_playback_audit();
select cron.schedule('screenflow-clean-old-playback-events','0 4 * * *',
  'delete from public.tv_playback_events where occurred_at<now()-interval ''90 days''');
