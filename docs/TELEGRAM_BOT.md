# Telegram birthday bot (Oq-Ariq OILASI)

Posts “Happy birthday” in your family Telegram group at ~10:00 in a chosen
timezone, with the age they turn and a birthday card image. Also DMs the
person when they have linked the bot with `/start`.

Bot already created: **@forusbirthdaybot**

## 1. BotFather (done / verify)

1. Token → Supabase secret `TELEGRAM_BOT_TOKEN` (revoke & recreate if the token was shared in chat)
2. `/setjoingrouproups` → Enable
3. `/setprivacy` → **Disable**

## 2. Secrets in Supabase (Oq-Ariq project)

Project ref: `kasvrgqbmydypwvkqzju`

Dashboard → **Edge Functions → Secrets**:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` — long random string
- `TELEGRAM_CRON_SECRET` — another random string (for GitHub Action)

```bash
cd myfamilytree
npx supabase login
npx supabase link --project-ref kasvrgqbmydypwvkqzju
npx supabase secrets set TELEGRAM_BOT_TOKEN="..." TELEGRAM_WEBHOOK_SECRET="..." TELEGRAM_CRON_SECRET="..."
```

## 3. Run the SQL migration

SQL Editor → run:

`supabase/migrations/20260810000001_telegram_birthday_bot.sql`

## 4. Deploy Edge Functions

```bash
cd myfamilytree
npx supabase functions deploy telegram-webhook
npx supabase functions deploy birthday-telegram
```

Set webhook:

```bash
curl.exe -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" ^
  -d "url=https://kasvrgqbmydypwvkqzju.supabase.co/functions/v1/telegram-webhook" ^
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" ^
  -d "allowed_updates=[\"message\",\"my_chat_member\"]"
```

## 5. Hourly cron (GitHub Action)

Add repo secrets on `kdrcoding/myfamilytree`:

- `OQARIQ_SUPABASE_URL` = `https://kasvrgqbmydypwvkqzju.supabase.co`
- `OQARIQ_TELEGRAM_CRON_SECRET` = same as `TELEGRAM_CRON_SECRET`

Workflow: `.github/workflows/birthday-telegram.yml`

## 6. In the app (owner)

Settings → **Telegram birthdays**:

1. Bot username: `forusbirthdaybot`
2. Enable + timezone (e.g. PT) + hour (10)
3. Add bot to family group → `/setgroup`
4. **Test send**
