-- Row Level Security policies.
--
-- The site is a public family website: everyone may READ the tree. Writes
-- are also allowed with the anon key because edit access is gated by the
-- app's client-side owner/member passwords — the same trust model the site
-- has always had. This keeps the free tier simple (no Supabase Auth users).
--
-- HONESTY NOTE: as with the previous LocalStorage version, a technically
-- skilled visitor could bypass the password gate and write to these tables.
-- If that ever becomes a concern, move writes behind Supabase Auth and
-- restrict the insert/update/delete policies to authenticated users.

alter table public.family_members enable row level security;
alter table public.family_relationships enable row level security;
alter table public.app_settings enable row level security;

-- Everyone can read.
create policy "public read members"
  on public.family_members for select
  to anon, authenticated
  using (true);

create policy "public read relationships"
  on public.family_relationships for select
  to anon, authenticated
  using (true);

create policy "public read settings"
  on public.app_settings for select
  to anon, authenticated
  using (true);

-- Writes with the anon key (see note above).
create policy "public write members"
  on public.family_members for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public write relationships"
  on public.family_relationships for all
  to anon, authenticated
  using (true)
  with check (true);

create policy "public write settings"
  on public.app_settings for all
  to anon, authenticated
  using (true)
  with check (true);
