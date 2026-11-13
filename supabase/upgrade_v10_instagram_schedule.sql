-- Screenflow v10: fully automatic secure Instagram polling every 10 minutes.
-- PostgreSQL generates its own secret. It is NEVER returned or committed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $block$
begin
 if not exists(select 1 from vault.secrets where name='screenflow_instagram_worker_key') then
  perform vault.create_secret(
   encode(extensions.gen_random_bytes(32),'hex'),
   'screenflow_instagram_worker_key',
   'Screenflow Instagram scheduled sync authentication'
  );
 end if;
end
$block$;
create or replace function public.screenflow_cron_auth(p_secret text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_secret is not null and length(p_secret)>=24 and exists(
 select 1 from vault.decrypted_secrets
 where name='screenflow_instagram_worker_key'
  and encode(extensions.digest(convert_to(p_secret,'UTF8'),'sha256'),'hex')
     =encode(extensions.digest(convert_to(decrypted_secret,'UTF8'),'sha256'),'hex')
 );
$$;
revoke all on function public.screenflow_cron_auth(text) from public,anon,authenticated;
grant execute on function public.screenflow_cron_auth(text) to service_role;
select cron.schedule(
 'screenflow-instagram-import-every-10m',
 '*/10 * * * *',
 $job$
 select net.http_post(
  url:='https://asixkabhesmhbqunxqby.supabase.co/functions/v1/screenflow-instagram',
  headers:=jsonb_build_object(
    'Content-Type','application/json',
    'x-screenflow-sync-secret',(select decrypted_secret
      from vault.decrypted_secrets
      where name='screenflow_instagram_worker_key'
      limit 1)
  ),
  body:='{"action":"sync"}'::jsonb,
  timeout_milliseconds:=15000
 );
 $job$
);
