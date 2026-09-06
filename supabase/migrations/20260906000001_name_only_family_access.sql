-- Name-only family access.
-- Visitors enter their name in the app (no family password in the client).
-- The default supabase-js anon key may SELECT/INSERT/UPDATE the same family
-- data editors already use. Owner JWT remains required for deletes,
-- relationship writes, telegram_settings writes, and audit-log reads.

create or replace function public.is_family_account()
returns boolean
language sql
stable
as $$
  select
    coalesce(auth.jwt() ->> 'email', '') in ('owner@oqariq.family', 'family@oqariq.family')
    or coalesce(auth.role(), '') = 'anon';
$$;

create or replace function public.log_family_change(
  p_action text,
  p_details jsonb,
  p_actor_name text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_family_account() then
    return;
  end if;
  insert into public.family_audit_log (actor, actor_name, action, details)
  values (
    coalesce(nullif(auth.jwt() ->> 'email', ''), 'visitor'),
    nullif(left(trim(coalesce(p_actor_name, '')), 60), ''),
    p_action,
    coalesce(p_details, '{}'::jsonb)
  );
  delete from public.family_audit_log
   where id not in (select id from public.family_audit_log order by at desc limit 1000);
end;
$$;

grant execute on function public.log_family_change(text, jsonb, text) to anon, authenticated;
grant execute on function public.take_family_backup(integer) to anon, authenticated;

-- family_members: editors already select/insert/update
create policy "anon read members"
  on public.family_members for select
  to anon using (true);
create policy "anon insert members"
  on public.family_members for insert
  to anon with check (true);
create policy "anon update members"
  on public.family_members for update
  to anon using (true) with check (true);

-- family_relationships: editors may read; writes stay owner-only
create policy "anon read relationships"
  on public.family_relationships for select
  to anon using (true);

-- app_settings: editors already select/insert/update
create policy "anon read settings"
  on public.app_settings for select
  to anon using (true);
create policy "anon insert settings"
  on public.app_settings for insert
  to anon with check (true);
create policy "anon update settings"
  on public.app_settings for update
  to anon using (true) with check (true);

-- memories / audio used by editors
create policy "anon read memories"
  on public.family_memories for select
  to anon using (true);
create policy "anon insert memories"
  on public.family_memories for insert
  to anon with check (true);
create policy "anon update memories"
  on public.family_memories for update
  to anon using (true) with check (true);

create policy "anon read audio stories"
  on public.family_audio_stories for select
  to anon using (true);
create policy "anon insert audio stories"
  on public.family_audio_stories for insert
  to anon with check (true);

-- join requests: editors submit; owner inbox stays authenticated
create policy "anon insert join requests"
  on public.family_join_requests for insert
  to anon with check (true);

-- photos: editors select/insert/update; delete stays owner
create policy "anon read photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'family-photos');
create policy "anon insert photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'family-photos');
create policy "anon update photos"
  on storage.objects for update
  to anon
  using (bucket_id = 'family-photos')
  with check (bucket_id = 'family-photos');
