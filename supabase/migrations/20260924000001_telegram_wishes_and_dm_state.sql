-- Written birthday wishes from Telegram DMs + short-lived DM conversation state.

create table if not exists public.telegram_birthday_wishes (
  id bigint generated always as identity primary key,
  person_id text not null references public.family_members (id) on delete cascade,
  year int not null,
  from_telegram_user_id bigint not null,
  from_display_name text not null,
  message text not null,
  delivered_dm boolean not null default false,
  created_at timestamptz not null default now(),
  constraint telegram_birthday_wishes_message_len check (
    char_length(trim(message)) >= 2 and char_length(message) <= 500
  )
);

create index if not exists telegram_birthday_wishes_person_year_idx
  on public.telegram_birthday_wishes (person_id, year, created_at desc);

alter table public.telegram_birthday_wishes enable row level security;

drop policy if exists "owner read telegram_birthday_wishes" on public.telegram_birthday_wishes;
create policy "owner read telegram_birthday_wishes"
  on public.telegram_birthday_wishes for select
  to authenticated
  using (public.is_owner_account());

-- Private-chat wizard state (wish text, claim confirm, find browse).
create table if not exists public.telegram_dm_state (
  telegram_user_id bigint primary key,
  state text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.telegram_dm_state enable row level security;

-- Service role only (Edge Functions). No client policies on purpose.
