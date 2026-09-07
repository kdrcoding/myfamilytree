-- Pin search_path on helper functions the linter flags, and match the
-- family clock (Asia/Tashkent) as the default timezone for new rows.

alter function public.set_updated_at() set search_path = public;
alter function public.is_owner_account() set search_path = public;
alter function public.is_family_account() set search_path = public;

alter table public.telegram_settings
  alter column timezone set default 'Asia/Tashkent';
