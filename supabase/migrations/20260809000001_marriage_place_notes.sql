-- ============================================================================
-- Wedding place + notes on the couple relationship row
-- Safe to re-run (IF NOT EXISTS).
-- ============================================================================

alter table public.family_relationships
  add column if not exists married_place text;

alter table public.family_relationships
  add column if not exists married_notes text;
