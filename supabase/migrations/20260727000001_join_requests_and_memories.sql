-- Join requests (pending "Add yourself" submissions) and photo memories
-- per person. Run in Supabase SQL Editor after the earlier migrations.

-- ─── Join requests ───────────────────────────────────────────────────────────

create table public.family_join_requests (
  id text primary key,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  submitter_name text,
  person jsonb not null,
  link jsonb,
  link_target_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_join_requests_status_idx
  on public.family_join_requests (status, submitted_at desc);

create trigger family_join_requests_set_updated_at
  before update on public.family_join_requests
  for each row execute function public.set_updated_at();

alter table public.family_join_requests enable row level security;

-- Both family accounts can read and submit; only the owner reviews/deletes.
create policy "family read join requests"
  on public.family_join_requests for select
  to authenticated using (public.is_family_account());
create policy "family insert join requests"
  on public.family_join_requests for insert
  to authenticated with check (public.is_family_account());
create policy "owner update join requests"
  on public.family_join_requests for update
  to authenticated using (public.is_owner_account())
  with check (public.is_owner_account());
create policy "owner delete join requests"
  on public.family_join_requests for delete
  to authenticated using (public.is_owner_account());

-- ─── Memories (extra photos + captions per person) ───────────────────────────

create table public.family_memories (
  id text primary key,
  person_id text not null
    references public.family_members (id) on delete cascade,
  title text,
  caption text,
  taken_on text
    check (taken_on is null or taken_on ~ '^\d{4}(-\d{2}){0,2}$'),
  photo text not null,
  sort_order bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_memories_person_id_idx
  on public.family_memories (person_id, sort_order, created_at);

create trigger family_memories_set_updated_at
  before update on public.family_memories
  for each row execute function public.set_updated_at();

alter table public.family_memories enable row level security;

create policy "family read memories"
  on public.family_memories for select
  to authenticated using (public.is_family_account());
create policy "family insert memories"
  on public.family_memories for insert
  to authenticated with check (public.is_family_account());
create policy "family update memories"
  on public.family_memories for update
  to authenticated using (public.is_family_account())
  with check (public.is_family_account());
create policy "owner delete memories"
  on public.family_memories for delete
  to authenticated using (public.is_owner_account());

-- Live updates for the owner's join-request inbox (optional; harmless if skipped).
do $$
begin
  begin
    alter publication supabase_realtime add table public.family_join_requests;
  exception
    when duplicate_object then null;
  end;
end $$;
