-- ============================================================================
-- Oq-Ariq OILASI — upgrade 2 (run ONCE in the Supabase SQL editor)
--
-- Adds everything the 2026-07-14 app update needs:
--   1. Change log: "who exactly" — the name typed at sign-in is stored with
--      every entry (actor_name).
--   2. Live sync: the two family tables join the realtime publication so
--      other phones see edits without refreshing.
--   3. Wedding anniversaries: marriage date on the couple's relationship row.
--   4. Photo storage: private `family-photos` bucket + family-only policies.
--
-- Requires supabase-upgrade.sql (auth lockdown) to have been run already —
-- it created is_family_account() / is_owner_account(). Safe to re-run.
-- ============================================================================

-- 1 ─ Change log: actor name ------------------------------------------------
alter table public.family_audit_log
  add column if not exists actor_name text;

drop function if exists public.log_family_change(text, jsonb);

create or replace function public.log_family_change(
  p_action text,
  p_details jsonb,
  p_actor_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_family_account() then
    return;
  end if;
  insert into public.family_audit_log (actor, actor_name, action, details)
  values (
    coalesce(auth.jwt() ->> 'email', 'unknown'),
    nullif(left(trim(coalesce(p_actor_name, '')), 60), ''),
    p_action,
    coalesce(p_details, '{}'::jsonb)
  );
  delete from public.family_audit_log
   where id not in (select id from public.family_audit_log order by at desc limit 1000);
end;
$$;

revoke execute on function public.log_family_change(text, jsonb, text) from public, anon;
grant execute on function public.log_family_change(text, jsonb, text) to authenticated;

-- 2 ─ Live sync: realtime publication ----------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.family_members;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.family_relationships;
exception when duplicate_object then null;
end $$;

-- 3 ─ Marriage dates ----------------------------------------------------------
alter table public.family_relationships
  add column if not exists married_on text
  check (married_on is null or married_on ~ '^\d{4}(-\d{2}){0,2}$');

-- 4 ─ Photo storage -----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', false)
on conflict (id) do nothing;

drop policy if exists "family read photos" on storage.objects;
create policy "family read photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'family-photos' and public.is_family_account());

drop policy if exists "family insert photos" on storage.objects;
create policy "family insert photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'family-photos' and public.is_family_account());

drop policy if exists "family update photos" on storage.objects;
create policy "family update photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'family-photos' and public.is_family_account())
  with check (bucket_id = 'family-photos' and public.is_family_account());

drop policy if exists "family delete photos" on storage.objects;
create policy "family delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'family-photos' and public.is_family_account());
