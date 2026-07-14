-- Automatic backups. The app calls take_family_backup() on every visit;
-- the function snapshots the whole family into family_backups at most once
-- per `min_hours` (default 20h, i.e. roughly daily) and keeps the newest 30.
-- Writes happen only inside the function (security definer) — the table has
-- no insert/update/delete policies at all.

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
    return false; -- recent backup exists, nothing to do
  end if;
  select count(*) into m_count from public.family_members;
  if m_count = 0 then
    return false; -- never bury good backups under snapshots of an empty database
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
