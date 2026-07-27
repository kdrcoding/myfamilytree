-- One-time upgrade: audio family stories (voice notes on a person).
-- Paste into Supabase → SQL Editor → Run after upgrade-3.
-- Safe to re-run.

create table if not exists public.family_audio_stories (
  id text primary key,
  person_id text not null
    references public.family_members (id) on delete cascade,
  title text,
  caption text,
  -- Storage path in family-photos bucket (audio/…)
  audio text not null,
  duration_sec int
    check (duration_sec is null or duration_sec >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_audio_stories_person_id_idx
  on public.family_audio_stories (person_id, created_at desc);

drop trigger if exists family_audio_stories_set_updated_at on public.family_audio_stories;
create trigger family_audio_stories_set_updated_at
  before update on public.family_audio_stories
  for each row execute function public.set_updated_at();

alter table public.family_audio_stories enable row level security;

drop policy if exists "family read audio stories" on public.family_audio_stories;
drop policy if exists "family insert audio stories" on public.family_audio_stories;
drop policy if exists "owner delete audio stories" on public.family_audio_stories;

create policy "family read audio stories"
  on public.family_audio_stories for select
  to authenticated using (public.is_family_account());
create policy "family insert audio stories"
  on public.family_audio_stories for insert
  to authenticated with check (public.is_family_account());
create policy "owner delete audio stories"
  on public.family_audio_stories for delete
  to authenticated using (public.is_owner_account());

-- Memories sort_order used Date.now() which overflowed Postgres integer.
-- Widen to bigint on existing installs (no-op if already bigint).
do $$
begin
  alter table public.family_memories
    alter column sort_order type bigint;
exception
  when undefined_table then null;
  when others then null;
end $$;
