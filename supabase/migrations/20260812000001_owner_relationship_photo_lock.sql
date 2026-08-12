-- Harden relationship + photo deletes to owner-only (editors keep member edits).

-- family_relationships: only owner may insert/update/delete links
drop policy if exists "family insert relationships" on public.family_relationships;
drop policy if exists "family update relationships" on public.family_relationships;

create policy "owner insert relationships"
  on public.family_relationships for insert
  to authenticated with check (public.is_owner_account());

create policy "owner update relationships"
  on public.family_relationships for update
  to authenticated using (public.is_owner_account())
  with check (public.is_owner_account());

-- storage: only owner may delete photos
drop policy if exists "family delete photos" on storage.objects;
create policy "owner delete photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'family-photos' and public.is_owner_account());
