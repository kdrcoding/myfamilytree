-- Family tree shared data schema.
-- Run this in the Supabase SQL editor (or `supabase db push`) BEFORE the
-- policies migration. See README "Shared data with Supabase".

-- People. Dates are stored as text because the app supports fuzzy dates
-- ("1954", "1954-06", "1954-06-12"). Photos are either an https URL or a
-- small data-URL; keep photos under ~1 MB or use Supabase Storage instead.
create table public.family_members (
  id text primary key,
  first_name text not null default '',
  last_name text not null default '',
  nickname text,
  gender text not null default 'unspecified'
    check (gender in ('male', 'female', 'unspecified')),
  birth_date text,
  death_date text,
  is_deceased boolean not null default false,
  photo text,
  city text,
  country text,
  occupation text,
  biography text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Relationships, one row per link. `key` is deterministic so the app can
-- upsert/delete idempotently:
--   spouse|<idA>|<idB>        (idA < idB alphabetically)
--   parent|<parentId>|<childId>
create table public.family_relationships (
  key text primary key,
  kind text not null check (kind in ('spouse', 'parent-child')),
  person_a text not null references public.family_members (id) on delete cascade,
  person_b text not null references public.family_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (person_a <> person_b)
);

create index family_relationships_person_a_idx on public.family_relationships (person_a);
create index family_relationships_person_b_idx on public.family_relationships (person_b);

-- Small key/value store for site-wide metadata (e.g. when the database was
-- seeded). UI preferences such as theme stay in each visitor's browser.
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh on every change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger family_members_set_updated_at
  before update on public.family_members
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();
