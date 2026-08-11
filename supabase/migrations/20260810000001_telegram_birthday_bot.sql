-- Telegram birthday bot (Oq-Ariq OILASI).
-- Settings for the family group, per-person DM links, and send dedupe.

create table public.telegram_settings (
  id int primary key default 1 check (id = 1),
  group_chat_id text,
  bot_username text,
  timezone text not null default 'America/Los_Angeles',
  send_hour int not null default 10 check (send_hour >= 0 and send_hour <= 23),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.telegram_settings (id) values (1)
on conflict (id) do nothing;

create trigger telegram_settings_set_updated_at
  before update on public.telegram_settings
  for each row execute function public.set_updated_at();

-- Relatives who /start the bot and pick themselves (for birthday DMs).
create table public.telegram_person_links (
  person_id text primary key references public.family_members (id) on delete cascade,
  telegram_user_id bigint not null,
  chat_id bigint not null,
  display_name text,
  linked_at timestamptz not null default now(),
  unique (telegram_user_id)
);

create index telegram_person_links_chat_id_idx
  on public.telegram_person_links (chat_id);

-- One group/DM birthday post per person per calendar year (family TZ year).
create table public.telegram_birthday_sent (
  person_id text not null references public.family_members (id) on delete cascade,
  year int not null,
  sent_at timestamptz not null default now(),
  primary key (person_id, year)
);

-- Pending /start link tokens (deep link from Settings: t.me/Bot?start=link_<token>).
create table public.telegram_link_tokens (
  token text primary key,
  person_id text not null references public.family_members (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz
);

create index telegram_link_tokens_person_idx
  on public.telegram_link_tokens (person_id);

-- Owner manages bot settings; family can read (to see invite instructions).
alter table public.telegram_settings enable row level security;
alter table public.telegram_person_links enable row level security;
alter table public.telegram_birthday_sent enable row level security;
alter table public.telegram_link_tokens enable row level security;

create policy "family read telegram_settings"
  on public.telegram_settings for select
  to authenticated using (public.is_family_account());
create policy "owner write telegram_settings"
  on public.telegram_settings for update
  to authenticated using (public.is_owner_account())
  with check (public.is_owner_account());

create policy "family read telegram_person_links"
  on public.telegram_person_links for select
  to authenticated using (public.is_family_account());
create policy "owner manage telegram_person_links"
  on public.telegram_person_links for all
  to authenticated using (public.is_owner_account())
  with check (public.is_owner_account());

create policy "owner read telegram_birthday_sent"
  on public.telegram_birthday_sent for select
  to authenticated using (public.is_owner_account());

create policy "owner manage telegram_link_tokens"
  on public.telegram_link_tokens for all
  to authenticated using (public.is_owner_account())
  with check (public.is_owner_account());
create policy "family read own link tokens"
  on public.telegram_link_tokens for select
  to authenticated using (public.is_family_account());
