-- Change log, readable by the owner only. Every data change the app makes
-- is recorded through log_family_change(); the function stamps the actor
-- from the signed-in account itself so a client can't fake who did it.

create table public.family_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb
);

alter table public.family_audit_log enable row level security;

create policy "owner read audit log"
  on public.family_audit_log for select
  to authenticated using (public.is_owner_account());
-- No insert/update/delete policies: writes happen only inside the function.

create or replace function public.log_family_change(p_action text, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_account() then
    return;
  end if;
  insert into public.family_audit_log (actor, action, details)
  values (coalesce(auth.jwt() ->> 'email', 'unknown'), p_action, coalesce(p_details, '{}'::jsonb));
  delete from public.family_audit_log
   where id not in (select id from public.family_audit_log order by at desc limit 1000);
end;
$$;

revoke execute on function public.log_family_change(text, jsonb) from public, anon;
grant execute on function public.log_family_change(text, jsonb) to authenticated;
