-- ============================================================================
-- ONE-TIME UPGRADE — run this whole file in the Supabase dashboard SQL editor
-- (project kasvrgqbmydypwvkqzju → SQL Editor → New query → paste → Run).
--
-- BEFORE running, also do these two things in the dashboard:
--   1. Authentication → Users → Add user → Create new user:
--        email: owner@oqariq.family    password: RootsKeeper!2026
--        email: family@oqariq.family   password: oqariq633
--      (tick "Auto Confirm User" for both)
--   2. Authentication → Sign In / Up → disable "Allow new users to sign up".
--
-- After this file runs, the database only answers to those two accounts —
-- the public key alone can no longer read the family data.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Divorce support (from migration 20260715000001_divorced_kind.sql)
-- ---------------------------------------------------------------------------
alter table public.family_relationships
  drop constraint family_relationships_kind_check;

alter table public.family_relationships
  add constraint family_relationships_kind_check
  check (kind in ('spouse', 'divorced', 'parent-child'));

-- ---------------------------------------------------------------------------
-- 2. Real access control (from migration 20260715000002_auth_lockdown.sql)
-- ---------------------------------------------------------------------------
drop policy "public read members" on public.family_members;
drop policy "public read relationships" on public.family_relationships;
drop policy "public read settings" on public.app_settings;
drop policy "public write members" on public.family_members;
drop policy "public write relationships" on public.family_relationships;
drop policy "public write settings" on public.app_settings;

create or replace function public.is_family_account()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '')
         in ('owner@oqariq.family', 'family@oqariq.family');
$$;

create or replace function public.is_owner_account()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'owner@oqariq.family';
$$;

create policy "family read members"
  on public.family_members for select
  to authenticated using (public.is_family_account());
create policy "family insert members"
  on public.family_members for insert
  to authenticated with check (public.is_family_account());
create policy "family update members"
  on public.family_members for update
  to authenticated using (public.is_family_account()) with check (public.is_family_account());
create policy "owner delete members"
  on public.family_members for delete
  to authenticated using (public.is_owner_account());

create policy "family read relationships"
  on public.family_relationships for select
  to authenticated using (public.is_family_account());
create policy "family insert relationships"
  on public.family_relationships for insert
  to authenticated with check (public.is_family_account());
create policy "family update relationships"
  on public.family_relationships for update
  to authenticated using (public.is_family_account()) with check (public.is_family_account());
create policy "owner delete relationships"
  on public.family_relationships for delete
  to authenticated using (public.is_owner_account());

create policy "family read settings"
  on public.app_settings for select
  to authenticated using (public.is_family_account());
create policy "family insert settings"
  on public.app_settings for insert
  to authenticated with check (public.is_family_account());
create policy "family update settings"
  on public.app_settings for update
  to authenticated using (public.is_family_account()) with check (public.is_family_account());
create policy "owner delete settings"
  on public.app_settings for delete
  to authenticated using (public.is_owner_account());

-- ---------------------------------------------------------------------------
-- 3. Automatic backups (from migration 20260715000003_backups.sql)
-- ---------------------------------------------------------------------------
create table public.family_backups (
  id bigint generated always as identity primary key,
  taken_at timestamptz not null default now(),
  member_count int not null default 0,
  relationship_count int not null default 0,
  data jsonb not null
);

alter table public.family_backups enable row level security;

create policy "family read backups"
  on public.family_backups for select
  to authenticated using (public.is_family_account());

create or replace function public.take_family_backup(min_hours int default 20)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  last_taken timestamptz;
  m_count int;
  r_count int;
begin
  if not public.is_family_account() then
    return false;
  end if;
  select max(taken_at) into last_taken from public.family_backups;
  if last_taken is not null and last_taken > now() - make_interval(hours => min_hours) then
    return false;
  end if;
  select count(*) into m_count from public.family_members;
  if m_count = 0 then
    return false;
  end if;
  select count(*) into r_count from public.family_relationships;
  insert into public.family_backups (data, member_count, relationship_count)
  values (
    jsonb_build_object(
      'members', coalesce((select jsonb_agg(to_jsonb(m)) from public.family_members m), '[]'::jsonb),
      'relationships', coalesce((select jsonb_agg(to_jsonb(r)) from public.family_relationships r), '[]'::jsonb)
    ),
    m_count,
    r_count
  );
  delete from public.family_backups
   where id not in (select id from public.family_backups order by taken_at desc limit 30);
  return true;
end;
$$;

revoke execute on function public.take_family_backup(int) from public, anon;
grant execute on function public.take_family_backup(int) to authenticated;
