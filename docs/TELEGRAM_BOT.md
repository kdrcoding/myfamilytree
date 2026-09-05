# Telegram birthday bot (Oq-Ariq OILASI)

Posts a warm **Uzbek** “Tug‘ilgan kuningiz muborak” in your **family Telegram
group**, with age, a birthday card, a no-password celebration page, and an
in-group **Men nishonlayman** button. Relatives stay in the chat; their
Telegram name is saved on the birthday page and announced in the group.

Bot: **@forusbirthdaybot**  
Public page: `https://myfamilytree-smoky.vercel.app/bday/<personId>`

## 1. BotFather

1. Token → Supabase secret `TELEGRAM_BOT_TOKEN`
2. `/setjoingrouproups` → Enable
3. `/setprivacy` → **Disable**

## 2. Secrets (Oq-Ariq project `kasvrgqbmydypwvkqzju`)

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `TELEGRAM_CRON_SECRET`
- Optional: `PUBLIC_APP_URL` = `https://myfamilytree-smoky.vercel.app`

## 3. SQL migrations

Run in the Supabase SQL Editor (in order):

1. `supabase/migrations/20260810000001_telegram_birthday_bot.sql`
2. `supabase/migrations/20260811000001_telegram_birthday_cheers.sql`

## 4. Deploy Edge Functions

```powershell
cd C:\Users\Mqodi\projects\myfamilytree
npx supabase functions deploy telegram-webhook --no-verify-jwt
npx supabase functions deploy birthday-telegram --no-verify-jwt
npx supabase functions deploy birthday-public --no-verify-jwt
```

Set webhook (once). `callback_query` is required so **Men nishonlayman** works
in the group. The functions also re-apply this if the old webhook is missing it.

```powershell
curl.exe -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" `
  -d "url=https://kasvrgqbmydypwvkqzju.supabase.co/functions/v1/telegram-webhook" `
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>" `
  -d "allowed_updates=[`"message`",`"my_chat_member`",`"callback_query`"]"
```

## 5. GitHub Action secrets

- `OQARIQ_SUPABASE_URL` = `https://kasvrgqbmydypwvkqzju.supabase.co`
- `OQARIQ_TELEGRAM_CRON_SECRET` = same as `TELEGRAM_CRON_SECRET`

## 6. In the app (owner)

Settings → **Telegram birthdays**:

1. Bot username: `forusbirthdaybot`
2. Enable + timezone + hour
3. Add bot to group → `/setgroup`
4. **Test send** — group gets an Uzbek wish, card, page link, and in-group button
5. Tap **Men nishonlayman** in the group (no need to open a private chat)

The card also shows how many people have a full birth date (month + day). The
bot cannot post for year-only or empty dates.

## Notes

- Cron runs hourly via GitHub Actions. Posts start at the configured **send hour**
  (family timezone) and will still catch up later the same day if Actions is delayed.
- One post per person per year (`telegram_birthday_sent`).
- Full `YYYY-MM-DD` birth dates only — same rule as the website calendar.
