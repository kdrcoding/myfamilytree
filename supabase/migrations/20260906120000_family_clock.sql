-- Public family clock: timezone only. Bot chat ids stay owner/authenticated.

create or replace view public.family_clock as
  select timezone
  from public.telegram_settings
  where id = 1;

revoke all on public.family_clock from public;
grant select on public.family_clock to anon, authenticated;

comment on view public.family_clock is
  'Family calendar timezone for Home and celebrations. No Telegram secrets.';
