-- Web birthday cheers + owner-only bot run health log.

alter table public.telegram_birthday_cheers
  alter column telegram_user_id drop not null;

alter table public.telegram_birthday_cheers
  add column if not exists source text not null default 'telegram';

alter table public.telegram_birthday_cheers
  drop constraint if exists telegram_birthday_cheers_source_check;

alter table public.telegram_birthday_cheers
  add constraint telegram_birthday_cheers_source_check
  check (source in ('telegram', 'web'));

-- One web cheer per person/year/name (case-insensitive).
create unique index if not exists telegram_birthday_cheers_web_name_uidx
  on public.telegram_birthday_cheers (person_id, year, lower(trim(display_name)))
  where source = 'web';

-- Cron / test run history for owner Settings health panel.
create table if not exists public.telegram_bot_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean not null default false,
  trigger text not null default 'cron',
  summary jsonb not null default '{}'::jsonb,
  error text
);

create index if not exists telegram_bot_runs_started_at_idx
  on public.telegram_bot_runs (started_at desc);

alter table public.telegram_bot_runs enable row level security;

drop policy if exists "owner read telegram_bot_runs" on public.telegram_bot_runs;
create policy "owner read telegram_bot_runs"
  on public.telegram_bot_runs for select
  to authenticated
  using (public.is_owner_account());

-- Quick health columns on settings (owner reads via existing family/owner policies).
alter table public.telegram_settings
  add column if not exists last_run_at timestamptz;

alter table public.telegram_settings
  add column if not exists last_ok_at timestamptz;

alter table public.telegram_settings
  add column if not exists last_run_ok boolean;

alter table public.telegram_settings
  add column if not exists last_run_error text;

alter table public.telegram_settings
  add column if not exists last_health_alert_at timestamptz;
