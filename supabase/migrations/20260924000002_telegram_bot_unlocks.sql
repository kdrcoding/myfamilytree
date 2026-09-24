-- Private-chat unlock after family password (same SHA-256 as the website).

create table if not exists public.telegram_bot_unlocks (
  telegram_user_id bigint primary key,
  unlocked_at timestamptz not null default now()
);

alter table public.telegram_bot_unlocks enable row level security;

-- Service role only (Edge Functions). No client policies on purpose.
