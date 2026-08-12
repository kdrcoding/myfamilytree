import {
  ageTurning,
  corsHeaders,
  createServiceClient,
  displayName,
  isBirthdayToday,
  jsonResponse,
  localParts,
  monthDay,
  requireEnv,
  telegramApi,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import { buildBirthdayCardPng } from '../_shared/birthdayCard.ts';
import { birthdayPageUrl, birthdayWishCaption, publicAppUrl } from '../_shared/wishes.ts';

type SettingsRow = {
  group_chat_id: string | null;
  bot_username: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
};

async function assertAuthorized(req: Request): Promise<void> {
  const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET');
  if (!cronSecret) throw new Error('TELEGRAM_CRON_SECRET missing');
  if (req.headers.get('x-cron-secret') === cronSecret) return;

  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  // Owner JWT from the app (Test send). Never accept the service-role key here.
  const url = requireEnv('SUPABASE_URL');
  const anon =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    '';
  if (!anon) throw new Error('Unauthorized');
  const userRes = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: anon },
  });
  if (!userRes.ok) throw new Error('Unauthorized');
  const user = await userRes.json();
  if (user?.email !== 'owner@oqariq.family') {
    throw new Error('Owner only');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAuthorized(req);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const force = Boolean(body.force);
    const testPersonId = typeof body.testPersonId === 'string' ? body.testPersonId : null;

    const db = createServiceClient();
    const settingsRows = await db.rest<SettingsRow[]>('telegram_settings', {
      query: { select: '*', id: 'eq.1' },
    });
    const settings = settingsRows[0];
    if (!settings) {
      return jsonResponse({ ok: false, error: 'telegram_settings missing — run migration' }, 500);
    }
    if (!settings.enabled && !force) {
      return jsonResponse({ ok: true, skipped: 'disabled' });
    }
    if (!settings.group_chat_id) {
      // Even Test send needs a group — otherwise nothing visible happens.
      return jsonResponse({ ok: true, skipped: 'no_group_chat_id', count: 0 });
    }

    const tz = settings.timezone || 'America/Los_Angeles';
    const local = localParts(tz);
    // Exact hour match is fragile: GitHub Actions cron is often delayed 10–50+
    // minutes. Once local time reaches send_hour on a birthday day, keep trying
    // later hours the same day. telegram_birthday_sent prevents double posts.
    if (!force && local.hour < settings.send_hour) {
      return jsonResponse({
        ok: true,
        skipped: 'before_send_hour',
        localHour: local.hour,
        sendHour: settings.send_hour,
        timezone: tz,
      });
    }

    const members = await db.rest<FamilyMemberRow[]>('family_members', {
      query: { select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo' },
    });

    const already = await db.rest<{ person_id: string }[]>('telegram_birthday_sent', {
      query: { select: 'person_id', year: `eq.${local.year}` },
    });
    const sentSet = new Set(already.map((r) => r.person_id));

    const celebrating = members.filter((m) => {
      if (testPersonId) return m.id === testPersonId;
      if (m.is_deceased || m.death_date) return false;
      const md = monthDay(m.birth_date);
      if (!md) return false;
      if (!isBirthdayToday(md, local)) return false;
      if (!force && sentSet.has(m.id)) return false;
      return true;
    });

    const bot = (settings.bot_username || '').replace(/^@/, '');
    const results: { personId: string; group: boolean; error?: string }[] = [];

    for (const person of celebrating) {
      try {
        const md = monthDay(person.birth_date);
        const age = md ? ageTurning(md, local.year) : null;
        const name = displayName(person);
        const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;
        const png = await buildBirthdayCardPng({ name, age, photoUrl });
        const pageUrl = birthdayPageUrl(person.id);
        const wish = birthdayWishCaption(name, age);
        const caption = `${wish}\n\n🔗 Open the birthday page (no password):\n${pageUrl}`;

        const keyboard: { text: string; url: string }[][] = [
          [{ text: '🎉 Open birthday page', url: pageUrl }],
        ];
        if (bot) {
          const payload = `cheer_${person.id}_${local.year}`;
          if (payload.length <= 64) {
            keyboard.push([
              {
                text: "💛 I'm celebrating",
                url: `https://t.me/${bot}?start=${payload}`,
              },
            ]);
          }
        } else {
          console.warn('bot_username missing — celebrate button skipped');
        }

        let groupOk = false;
        if (settings.group_chat_id) {
          const form = new FormData();
          form.set('chat_id', settings.group_chat_id);
          form.set('caption', caption.slice(0, 1024));
          form.set('photo', new Blob([png], { type: 'image/png' }), 'birthday.png');
          form.set('reply_markup', JSON.stringify({ inline_keyboard: keyboard }));
          await telegramApi('sendPhoto', form);
          groupOk = true;
        }

        // Only mark sent after Telegram accepts the photo. Empty-body REST
        // responses must not throw (see createServiceClient.rest).
        if (groupOk && !(force && testPersonId && body.skipDedupe)) {
          await db.rest('telegram_birthday_sent', {
            method: 'POST',
            query: { on_conflict: 'person_id,year' },
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ person_id: person.id, year: local.year }),
          });
        }

        results.push({ personId: person.id, group: groupOk });
      } catch (personError) {
        const msg = personError instanceof Error ? personError.message : String(personError);
        console.error('birthday send failed', person.id, personError);
        results.push({ personId: person.id, group: false, error: msg });
      }
    }

    return jsonResponse({
      ok: true,
      timezone: tz,
      local,
      appUrl: publicAppUrl(),
      count: results.filter((r) => r.group).length,
      results,
    });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg === 'Unauthorized' || msg === 'Owner only' ? 401 : 500;
    return jsonResponse({ ok: false, error: msg }, status);
  }
});
