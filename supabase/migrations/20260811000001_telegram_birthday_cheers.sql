-- People who tap “I’m celebrating” on a birthday post (Telegram display name).

create table public.telegram_birthday_cheers (
  id bigint generated always as identity primary key,
  person_id text not null references public.family_members (id) on delete cascade,
  year int not null,
  telegram_user_id bigint not null,
  display_name text not null,
  username text,
  created_at timestamptz not null default now(),
  unique (person_id, year, telegram_user_id)
);

create index telegram_birthday_cheers_person_year_idx
  on public.telegram_birthday_cheers (person_id, year);

alter table public.telegram_birthday_cheers enable row level security;

create policy "owner read telegram_birthday_cheers"
  on public.telegram_birthday_cheers for select
  to authenticated using (public.is_owner_account());
