-- Soft unlock must write birth dates only via birthday-public set-birth (service role).
-- Family editors use family@ JWT; anon direct UPDATE is closed.
drop policy if exists "anon update members" on public.family_members;
