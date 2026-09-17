// Bundle ../_shared locally. Do not import from raw.githubusercontent.com —
// npm: WebP decoders break when those remote files load on Edge.
import {
  ageTurning,
  corsHeaders,
  createServiceClient,
  displayName,
  ensureCallbackWebhook,
  isBirthdayToday,
  isoWeekPeriod,
  jsonResponse,
  localParts,
  monthDay,
  requireEnv,
  telegramApi,
  DEFAULT_FAMILY_TIMEZONE,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import { buildBirthdayCardPng, type BirthdayCardOpts } from '../_shared/birthdayCard.ts';
import {
  birthdayCaption,
  birthdayPageUrl,
  cheerCallbackData,
  missingDatesPageUrl,
  publicAppUrl,
  TG_BUTTONS,
} from '../_shared/wishes.ts';
import { missingDatesNotice, whoIsThisUzbek } from '../_shared/whoIsThis.ts';

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

async function sendPhotoForm(
  chatId: string,
  png: Uint8Array,
  caption: string,
  markup: string,
  filename: string,
): Promise<void> {
  const form = new FormData();
  form.set('chat_id', chatId);
  form.set('caption', caption);
  const bytes = new Uint8Array(png.byteLength);
  bytes.set(png);
  form.set('photo', new Blob([bytes], { type: 'image/png' }), filename);
  form.set('reply_markup', markup);
  await telegramApi('sendPhoto', form);
}

/** Always sendPhoto. Retry a simpler card with the same themed pictures — never text-only. */
async function sendGroupBirthdayPhoto(opts: {
  chatId: string;
  caption: string;
  markup: string;
  card: BirthdayCardOpts;
}): Promise<void> {
  const attempts: Array<{ simple: boolean; file: string }> = [
    { simple: false, file: 'birthday.png' },
    { simple: true, file: 'birthday-simple.png' },
  ];
  let lastError: unknown;
  for (const attempt of attempts) {
    let png: Uint8Array;
    try {
      png = await buildBirthdayCardPng({ ...opts.card, simple: attempt.simple });
    } catch (err) {
      lastError = err;
      console.error('birthday card render failed', attempt.file, err);
      continue;
    }
    try {
      await sendPhotoForm(opts.chatId, png, opts.caption, opts.markup, attempt.file);
      return;
    } catch (err) {
      lastError = err;
      console.error('sendPhoto failed', attempt.file, err);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('sendPhoto failed');
}

type ServiceDb = ReturnType<typeof createServiceClient>;
type RelRow = { kind: string; person_a: string; person_b: string };

/** Insert first. Empty representation = another run already claimed this person/year. */
async function claimBirthdaySent(
  db: ServiceDb,
  personId: string,
  year: number,
): Promise<boolean> {
  const rows = await db.rest<{ person_id: string }[]>('telegram_birthday_sent', {
    method: 'POST',
    query: { on_conflict: 'person_id,year' },
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ person_id: personId, year }),
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function releaseBirthdaySent(db: ServiceDb, personId: string, year: number): Promise<void> {
  await db.rest('telegram_birthday_sent', {
    method: 'DELETE',
    query: { person_id: `eq.${personId}`, year: `eq.${year}` },
  });
}

async function claimNotice(db: ServiceDb, kind: string, period: string): Promise<boolean> {
  const rows = await db.rest<{ kind: string }[]>('telegram_notices_sent', {
    method: 'POST',
    query: { on_conflict: 'kind,period' },
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ kind, period }),
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function releaseNotice(db: ServiceDb, kind: string, period: string): Promise<void> {
  await db.rest('telegram_notices_sent', {
    method: 'DELETE',
    query: { kind: `eq.${kind}`, period: `eq.${period}` },
  });
}

async function maybeSendMissingDates(opts: {
  db: ServiceDb;
  chatId: string;
  members: FamilyMemberRow[];
  local: { year: number; month: number; day: number; hour: number; weekday: string };
  force: boolean;
}): Promise<{ sent: boolean; skipped?: string; count?: number }> {
  if (opts.force) return { sent: false, skipped: 'force' };
  // Monday preferred; Tuesday catch-up if GitHub Actions missed Monday.
  if (opts.local.weekday !== 'Mon' && opts.local.weekday !== 'Tue') {
    return { sent: false, skipped: 'not_monday_or_tuesday' };
  }
  const names = opts.members
    .filter((m) => !m.is_deceased && !m.death_date && !monthDay(m.birth_date))
    .map((m) => displayName(m));
  if (names.length === 0) return { sent: false, skipped: 'none_missing', count: 0 };

  const period = isoWeekPeriod(opts.local.year, opts.local.month, opts.local.day);
  const claimed = await claimNotice(opts.db, 'missing-dates', period);
  if (!claimed) return { sent: false, skipped: 'already_claimed', count: names.length };

  try {
    const datesUrl = missingDatesPageUrl();
    await telegramApi('sendMessage', {
      chat_id: opts.chatId,
      text: missingDatesNotice(names, datesUrl),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: TG_BUTTONS.fillDates, url: datesUrl }]],
      },
    });
    return { sent: true, count: names.length };
  } catch (err) {
    await releaseNotice(opts.db, 'missing-dates', period).catch((releaseErr) => {
      console.error('release missing-dates claim failed', releaseErr);
    });
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    await assertAuthorized(req);
    await ensureCallbackWebhook();

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

    const tz = settings.timezone || DEFAULT_FAMILY_TIMEZONE;
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
      query: {
        select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      },
    });

    let rels: RelRow[] = [];
    try {
      rels = await db.rest<RelRow[]>('family_relationships', {
        query: { select: 'kind,person_a,person_b' },
      });
    } catch (err) {
      console.warn('relationships unavailable', err);
    }

    const already = await db.rest<{ person_id: string }[]>('telegram_birthday_sent', {
      query: { select: 'person_id', year: `eq.${local.year}` },
    });
    const sentSet = new Set(already.map((r) => r.person_id));

    const celebrating = members.filter((m) => {
      if (testPersonId) {
        if (m.id !== testPersonId) return false;
        if (m.is_deceased || m.death_date) return false;
        return true;
      }
      if (m.is_deceased || m.death_date) return false;
      const md = monthDay(m.birth_date);
      if (!md) return false;
      if (!isBirthdayToday(md, local)) return false;
      if (!force && sentSet.has(m.id)) return false;
      return true;
    });

    const bot = (settings.bot_username || '').replace(/^@/, '');
    const results: { personId: string; group: boolean; error?: string; skipped?: string }[] = [];
    const missingCount = members.filter(
      (m) => !m.is_deceased && !m.death_date && !monthDay(m.birth_date),
    ).length;
    const datesUrl = missingCount > 0 ? missingDatesPageUrl() : null;

    for (const person of celebrating) {
      const skipClaim = Boolean(force);
      let claimed = skipClaim;
      if (!skipClaim) {
        try {
          claimed = await claimBirthdaySent(db, person.id, local.year);
        } catch (claimErr) {
          const msg = claimErr instanceof Error ? claimErr.message : String(claimErr);
          console.error('birthday claim failed', person.id, claimErr);
          results.push({ personId: person.id, group: false, error: msg });
          continue;
        }
        if (!claimed) {
          results.push({ personId: person.id, group: false, skipped: 'already_claimed' });
          continue;
        }
      }

      try {
        const md = monthDay(person.birth_date);
        const age = md ? ageTurning(md, local.year) : null;
        const name = displayName(person);
        const whoLine = whoIsThisUzbek(person, members, rels);
        const photoUrl = person.photo ? await db.signPhoto(person.photo) : null;
        let photoBytes: Uint8Array | null = null;
        if (person.photo) {
          try {
            photoBytes = await db.downloadPhotoBytes(person.photo);
          } catch (photoErr) {
            console.warn('photo download failed', person.id, photoErr);
          }
        }
        const pageUrl = birthdayPageUrl(person.id);
        const caption = birthdayCaption(name, age, pageUrl, `${person.id}:${local.year}`, whoLine);

        const keyboard: Record<string, string>[][] = [[{ text: TG_BUTTONS.openPage, url: pageUrl }]];
        const payload = cheerCallbackData(person.id, local.year);
        if (payload.length <= 64) {
          keyboard.push([{ text: TG_BUTTONS.celebrate, callback_data: payload }]);
        } else if (bot) {
          keyboard.push([
            {
              text: TG_BUTTONS.celebrate,
              url: `https://t.me/${bot}?start=${payload}`,
            },
          ]);
        }
        if (datesUrl) {
          keyboard.push([{ text: TG_BUTTONS.fillDates, url: datesUrl }]);
        }

        let groupOk = false;
        if (settings.group_chat_id) {
          const markup = JSON.stringify({ inline_keyboard: keyboard });
          await sendGroupBirthdayPhoto({
            chatId: settings.group_chat_id,
            caption: caption.slice(0, 1024),
            markup,
            card: {
              name,
              age,
              photoUrl,
              photoBytes,
              gender: person.gender,
              designSeed: `${person.id}:${local.year}`,
              whoLine,
            },
          });
          groupOk = true;
        }

        if (groupOk && skipClaim && !(testPersonId && body.skipDedupe)) {
          await db.rest('telegram_birthday_sent', {
            method: 'POST',
            query: { on_conflict: 'person_id,year' },
            headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ person_id: person.id, year: local.year }),
          });
        }

        results.push({ personId: person.id, group: groupOk });
      } catch (personError) {
        if (!skipClaim && claimed) {
          await releaseBirthdaySent(db, person.id, local.year).catch((releaseErr) => {
            console.error('release birthday claim failed', person.id, releaseErr);
          });
        }
        const msg = personError instanceof Error ? personError.message : String(personError);
        console.error('birthday send failed', person.id, personError);
        results.push({ personId: person.id, group: false, error: msg });
      }
    }

    let missingDates: { sent: boolean; skipped?: string; count?: number } | undefined;
    try {
      missingDates = await maybeSendMissingDates({
        db,
        chatId: settings.group_chat_id as string,
        members,
        local,
        force,
      });
    } catch (noticeErr) {
      console.error('missing-dates notice failed', noticeErr);
      missingDates = {
        sent: false,
        skipped: noticeErr instanceof Error ? noticeErr.message : String(noticeErr),
      };
    }

    return jsonResponse({
      ok: true,
      timezone: tz,
      local,
      appUrl: publicAppUrl(),
      count: results.filter((r) => r.group).length,
      results,
      missingDates,
    });
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    const status = msg === 'Unauthorized' || msg === 'Owner only' ? 401 : 500;
    return jsonResponse({ ok: false, error: msg }, status);
  }
});
