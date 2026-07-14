-- Real access control. Before this migration anyone holding the public anon
-- key could read/write the tables; now the database itself only answers to
-- the two family accounts (created in the dashboard, sign-ups disabled):
--   owner@oqariq.family   -> owner password, full control
--   family@oqariq.family  -> family password, view + add
-- The additive-only rules for the family role stay enforced in the app.

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

-- family_members: both accounts read/add/update, only the owner deletes.
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

-- family_relationships: same rules (updates cover the divorced flag).
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

-- app_settings (seed marker, geocode cache): both accounts read/write,
-- only the owner deletes.
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
