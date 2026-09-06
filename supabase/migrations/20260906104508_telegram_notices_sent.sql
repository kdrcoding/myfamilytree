-- Weekly group notices (missing dates, etc.). Service role writes; owner can read.
create table if not exists public.telegram_notices_sent (
  kind text not null,
  period text not null,
  sent_at timestamptz not null default now(),
  primary key (kind, period)
);

alter table public.telegram_notices_sent enable row level security;

drop policy if exists "owner read telegram_notices_sent" on public.telegram_notices_sent;
create policy "owner read telegram_notices_sent"
  on public.telegram_notices_sent for select
  to authenticated
  using (public.is_owner_account());
