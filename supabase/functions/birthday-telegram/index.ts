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

type SettingsRow = {
  group_chat_id: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
};

async function assertAuthorized(req: Request): Promise<void> {
  const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return;

  const auth = req.headers.get('Authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (serviceKey && auth === `Bearer ${serviceKey}`) return;

  // Owner JWT from the app (functions.invoke).
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
  const url = requireEnv('SUPABASE_URL');
  const anon =
    Deno.env.get('SUPABASE_ANON_KEY') ||
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
    serviceKey;
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
    if (!settings.group_chat_id && !force) {
      return jsonResponse({ ok: true, skipped: 'no_group_chat_id' });
    }

    const tz = settings.timezone || 'America/Los_Angeles';
    const local = localParts(tz);
    if (!force && local.hour !== settings.send_hour) {
      return jsonResponse({
        ok: true,
        skipped: 'wrong_hour',
        localHour: local.hour,
        sendHour: settings.send_hour,
        timezone: tz,
      });
    }

    const members = await db.rest<FamilyMemberRow[]>('family_members', {
      query: { select: 'id,first_name,last_name,nickname,birth_date,death_date,is_deceased,photo' },
    });

    const links = await db.rest<{ person_id: string; chat_id: number }[]>(
      'telegram_person_links',
      { query: { select: 'person_id,chat_id' } },
    );
    const chatByPerson = new Map(links.map((l) => [l.person_id, l.chat_id]));

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

    const results: { personId: string; group: boolean; dm: boolean }[] = [];

    for (const person of celebrating) {
      const md = monthDay(person.birth_date);
      const age = md ? ageTurning(md, local.year) : null;
      const name = displayName(person);
      const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;
      const png = await buildBirthdayCardPng({ name, age, photoUrl });
      const caption =
        age != null
          ? `🎂 Happy birthday, ${name}! Turning ${age} today.`
          : `🎂 Happy birthday, ${name}!`;

      let groupOk = false;
      let dmOk = false;

      if (settings.group_chat_id) {
        const form = new FormData();
        form.set('chat_id', settings.group_chat_id);
        form.set('caption', caption);
        form.set('photo', new Blob([png], { type: 'image/png' }), 'birthday.png');
        await telegramApi('sendPhoto', form);
        groupOk = true;
      }

      const dmChat = chatByPerson.get(person.id);
      if (dmChat) {
        try {
          const form = new FormData();
          form.set('chat_id', String(dmChat));
          form.set(
            'caption',
            age != null
              ? `🎂 Happy birthday, ${name}! Wishing you a wonderful ${age}!`
              : `🎂 Happy birthday, ${name}!`,
          );
          form.set('photo', new Blob([png], { type: 'image/png' }), 'birthday.png');
          await telegramApi('sendPhoto', form);
          dmOk = true;
        } catch (err) {
          console.error('DM failed for', person.id, err);
        }
      }

      // Don't record dedupe for pure test of a specific person unless requested.
      if (!(force && testPersonId && body.skipDedupe)) {
        await db.rest('telegram_birthday_sent', {
          method: 'POST',
          query: { on_conflict: 'person_id,year' },
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ person_id: person.id, year: local.year }),
        });
      }

      results.push({ personId: person.id, group: groupOk, dm: dmOk });
    }

    return jsonResponse({
      ok: true,
      timezone: tz,
      local,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg === 'Unauthorized' || msg === 'Owner only' ? 401 : 500;
    return jsonResponse({ ok: false, error: msg }, status);
  }
});
