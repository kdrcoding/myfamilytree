-- Allow marking a couple as divorced. A divorced couple keeps its single
-- spouse row (same deterministic key "spouse|<idA>|<idB>"); only the kind
-- flips between 'spouse' and 'divorced'.
alter table public.family_relationships
  drop constraint family_relationships_kind_check;

alter table public.family_relationships
  add constraint family_relationships_kind_check
  check (kind in ('spouse', 'divorced', 'parent-child'));
