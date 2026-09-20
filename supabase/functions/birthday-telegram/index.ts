// Bundle ../_shared locally. Do not import from raw.githubusercontent.com —
// npm: WebP decoders break when those remote files load on Edge.
import {
  ageTurning,
  corsHeaders,
  createServiceClient,
  daysUntilBirthday,
  displayName,
  ensureCallbackWebhook,
  isBirthdayToday,
  isoWeekPeriod,
  jsonResponse,
  localParts,
  monthDay,
  requireEnv,
  shiftLocalDate,
  telegramApi,
  DEFAULT_FAMILY_TIMEZONE,
  type FamilyMemberRow,
} from '../_shared/telegram.ts';
import { buildBirthdayCardPng, type BirthdayCardOpts } from '../_shared/birthdayCard.ts';
import {
  birthdayCaption,
  birthdayPageUrl,
  botHealthAlertText,
  cheerCallbackData,
  missingDatesPageUrl,
  missingDatesPageLink,
  publicAppUrl,
  upcomingBirthdaysNotice,
  upcomingCardHeadline,
  upcomingCardSubtitle,
  upcomingNextUpCaption,
  TG_BUTTONS,
  type UpcomingBirthdayRow,
} from '../_shared/wishes.ts';
import { missingDatesNotice, whoIsThisUzbek } from '../_shared/whoIsThis.ts';

type SettingsRow = {
  group_chat_id: string | null;
  bot_username: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
  last_ok_at?: string | null;
  last_health_alert_at?: string | null;
};

async function assertAuthorized(req: Request): Promise<void> {
  const cronSecret = Deno.env.get('TELEGRAM_CRON_SECRET');
  if (!cronSecret) throw new Error('TELEGRAM_CRON_SECRET missing');
  if (req.headers.get('x-cron-secret') === cronSecret) return;

  await assertOwnerJwt(req);
}

/** Owner JWT only — used for mint/send dates helpers (not cron). */
async function assertOwnerJwt(req: Request): Promise<void> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized');
  }
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
}): Promise<{ sent: boolean; skipped?: string; count?: number; url?: string }> {
  const names = opts.members
    .filter((m) => !m.is_deceased && !m.death_date && !monthDay(m.birth_date))
    .map((m) => displayName(m));
  if (names.length === 0) return { sent: false, skipped: 'none_missing', count: 0 };

  // Owner "send now" bypasses weekday + weekly claim.
  if (!opts.force) {
    if (opts.local.weekday !== 'Mon' && opts.local.weekday !== 'Tue') {
      return { sent: false, skipped: 'not_monday_or_tuesday' };
    }
    const period = isoWeekPeriod(opts.local.year, opts.local.month, opts.local.day);
    const claimed = await claimNotice(opts.db, 'missing-dates', period);
    if (!claimed) return { sent: false, skipped: 'already_claimed', count: names.length };

    try {
      const datesUrl = await missingDatesPageUrl();
      await telegramApi('sendMessage', {
        chat_id: opts.chatId,
        text: missingDatesNotice(names, datesUrl),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [[{ text: TG_BUTTONS.fillDates, url: datesUrl }]],
        },
      });
      return { sent: true, count: names.length, url: datesUrl };
    } catch (err) {
      await releaseNotice(opts.db, 'missing-dates', period).catch((releaseErr) => {
        console.error('release missing-dates claim failed', releaseErr);
      });
      throw err;
    }
  }

  const datesUrl = await missingDatesPageUrl();
  await telegramApi('sendMessage', {
    chat_id: opts.chatId,
    text: missingDatesNotice(names, datesUrl),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: TG_BUTTONS.fillDates, url: datesUrl }]],
    },
  });
  return { sent: true, count: names.length, url: datesUrl };
}

type UpcomingBuilt = {
  rows: UpcomingBirthdayRow[];
  nextMember: FamilyMemberRow | null;
  next: UpcomingBirthdayRow | null;
};

function buildUpcomingList(
  members: FamilyMemberRow[],
  local: { year: number; month: number; day: number },
): UpcomingBuilt {
  const enriched = members
    .filter((m) => !m.is_deceased && !m.death_date)
    .map((m) => {
      const md = monthDay(m.birth_date);
      if (!md) return null;
      const days = daysUntilBirthday(md, local);
      if (days < 0 || days > 7) return null;
      const nextYear =
        md.month < local.month || (md.month === local.month && md.day < local.day)
          ? local.year + 1
          : local.year;
      const age = ageTurning(md, nextYear);
      const row: UpcomingBirthdayRow = {
        name: displayName(m),
        days,
        month: md.month,
        day: md.day,
        age,
      };
      return { member: m, row };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort(
      (a, b) =>
        a.row.days - b.row.days || a.row.name.localeCompare(b.row.name),
    );

  return {
    rows: enriched.map((e) => e.row),
    nextMember: enriched[0]?.member ?? null,
    next: enriched[0]?.row ?? null,
  };
}

async function maybeSendUpcoming(opts: {
  db: ServiceDb;
  chatId: string;
  members: FamilyMemberRow[];
  local: { year: number; month: number; day: number; hour: number; weekday: string };
  /** Birthday test runs skip the weekly reminder. */
  force: boolean;
  /** Owner “send / preview now” — skip weekday + weekly claim. */
  ownerSend?: boolean;
}): Promise<{
  sent: boolean;
  skipped?: string;
  count?: number;
  photoSent?: boolean;
  text?: string;
  caption?: string;
}> {
  // Test birthday sends should not also fire the weekly reminder.
  if (opts.force && !opts.ownerSend) return { sent: false, skipped: 'force' };

  if (!opts.ownerSend && !['Sat', 'Sun', 'Mon'].includes(opts.local.weekday)) {
    return { sent: false, skipped: 'not_weekend_or_monday' };
  }

  const built = buildUpcomingList(opts.members, opts.local);
  if (built.rows.length === 0) return { sent: false, skipped: 'none_upcoming', count: 0 };

  // Sat/Sun/Mon share one claim key: ISO week of the Monday in this window
  // (Sat→W_N+1 of next Mon, Sun→same, Mon→that Mon). Avoids double posts across
  // the ISO week boundary between Sunday and Monday.
  let period = '';
  if (!opts.ownerSend) {
    const daysToMonday =
      opts.local.weekday === 'Sat' ? 2 : opts.local.weekday === 'Sun' ? 1 : 0;
    const monday = shiftLocalDate(opts.local, daysToMonday);
    period = isoWeekPeriod(monday.year, monday.month, monday.day);
    const claimed = await claimNotice(opts.db, 'upcoming-week', period);
    if (!claimed) return { sent: false, skipped: 'already_claimed', count: built.rows.length };
  }

  try {
    const datesUrl = await missingDatesPageUrl();
    const text = upcomingBirthdaysNotice(built.rows, datesUrl, 'uz');
    let photoSent = false;
    let caption: string | undefined;

    if (built.next && built.nextMember) {
      const person = built.nextMember;
      const name = built.next.name;
      const age = built.next.age;
      const pageUrl = birthdayPageUrl(person.id);
      caption = upcomingNextUpCaption(
        name,
        age,
        built.next.days,
        pageUrl,
        'uz',
        `upcoming:${person.id}:${built.next.month}-${built.next.day}`,
      );
      try {
        const photoUrl = person.photo ? await opts.db.signPhoto(person.photo) : null;
        let photoBytes: Uint8Array | null = null;
        if (person.photo) {
          try {
            photoBytes = await opts.db.downloadPhotoBytes(person.photo);
          } catch (photoErr) {
            console.warn('upcoming photo download failed', person.id, photoErr);
          }
        }
        const keyboard: Record<string, string>[][] = [
          [{ text: TG_BUTTONS.openPage, url: pageUrl }],
          [{ text: TG_BUTTONS.fillDates, url: datesUrl }],
        ];
        await sendGroupBirthdayPhoto({
          chatId: opts.chatId,
          caption: caption.slice(0, 1024),
          markup: JSON.stringify({ inline_keyboard: keyboard }),
          card: {
            name,
            age,
            photoUrl,
            photoBytes,
            gender: person.gender,
            designSeed: `upcoming:${person.id}:${built.next.month}-${built.next.day}`,
            headline: upcomingCardHeadline('uz'),
            subtitle: upcomingCardSubtitle(built.next.days, age, 'uz'),
          },
        });
        photoSent = true;
      } catch (photoErr) {
        console.error('upcoming next-up photo failed; sending text list only', photoErr);
      }
    }

    await telegramApi('sendMessage', {
      chat_id: opts.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [[{ text: TG_BUTTONS.fillDates, url: datesUrl }]],
      },
    });
    return { sent: true, count: built.rows.length, photoSent, text, caption };
  } catch (err) {
    if (period) {
      await releaseNotice(opts.db, 'upcoming-week', period).catch((releaseErr) => {
        console.error('release upcoming-week claim failed', releaseErr);
      });
    }
    throw err;
  }
}

async function previewUpcomingNotice(opts: {
  db: ServiceDb;
  members: FamilyMemberRow[];
  local: { year: number; month: number; day: number };
}): Promise<{
  ok: boolean;
  count: number;
  text: string;
  caption: string | null;
  nextName: string | null;
  skipped?: string;
}> {
  const built = buildUpcomingList(opts.members, opts.local);
  const datesUrl = await missingDatesPageUrl();
  const text = upcomingBirthdaysNotice(built.rows, datesUrl, 'uz');
  if (!built.next || !built.nextMember) {
    return { ok: true, count: 0, text, caption: null, nextName: null, skipped: 'none_upcoming' };
  }
  const pageUrl = birthdayPageUrl(built.nextMember.id);
  const caption = upcomingNextUpCaption(
    built.next.name,
    built.next.age,
    built.next.days,
    pageUrl,
    'uz',
    `upcoming:${built.nextMember.id}:${built.next.month}-${built.next.day}`,
  );
  return {
    ok: true,
    count: built.rows.length,
    text,
    caption,
    nextName: built.next.name,
  };
}

const HEALTH_ALERT_HOURS = 26;
const HEALTH_ALERT_COOLDOWN_HOURS = 12;

async function maybeSendHealthAlert(opts: {
  db: ServiceDb;
  chatId: string;
  settings: SettingsRow;
  force: boolean;
}): Promise<{ sent: boolean; skipped?: string; hours?: number }> {
  if (opts.force) return { sent: false, skipped: 'force' };
  // First deploy / no heartbeat yet — don't false-alarm the group.
  if (!opts.settings.last_ok_at) {
    return { sent: false, skipped: 'bootstrap' };
  }
  const lastOk = new Date(opts.settings.last_ok_at).getTime();
  if (!Number.isFinite(lastOk)) return { sent: false, skipped: 'bootstrap' };
  const hours = (Date.now() - lastOk) / 3_600_000;
  if (hours < HEALTH_ALERT_HOURS) return { sent: false, skipped: 'healthy', hours };

  const lastAlert = opts.settings.last_health_alert_at
    ? new Date(opts.settings.last_health_alert_at).getTime()
    : 0;
  if (lastAlert > 0 && Date.now() - lastAlert < HEALTH_ALERT_COOLDOWN_HOURS * 3_600_000) {
    return { sent: false, skipped: 'alert_cooldown', hours };
  }

  const lastOkLabel = new Date(opts.settings.last_ok_at).toISOString();
  await telegramApi('sendMessage', {
    chat_id: opts.chatId,
    text: botHealthAlertText(Math.floor(hours), lastOkLabel),
    parse_mode: 'HTML',
  });
  await opts.db.rest('telegram_settings', {
    method: 'PATCH',
    query: { id: 'eq.1' },
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ last_health_alert_at: new Date().toISOString() }),
  });
  return { sent: true, hours };
}

async function recordBotRun(
  db: ServiceDb,
  opts: {
    trigger: string;
    ok: boolean;
    summary: Record<string, unknown>;
    error?: string;
    startedAt: string;
  },
): Promise<void> {
  const finishedAt = new Date().toISOString();
  try {
    await db.rest('telegram_bot_runs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        started_at: opts.startedAt,
        finished_at: finishedAt,
        ok: opts.ok,
        trigger: opts.trigger,
        summary: opts.summary,
        error: opts.error ?? null,
      }),
    });
  } catch (err) {
    console.warn('telegram_bot_runs insert failed', err);
  }
  try {
    await db.rest('telegram_settings', {
      method: 'PATCH',
      query: { id: 'eq.1' },
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        last_run_at: finishedAt,
        last_run_ok: opts.ok,
        last_run_error: opts.error ?? null,
        ...(opts.ok ? { last_ok_at: finishedAt } : {}),
      }),
    });
  } catch (err) {
    console.warn('telegram_settings health patch failed', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  let db: ReturnType<typeof createServiceClient> | null = null;
  let trigger = 'cron';
  let force = false;

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = typeof body.action === 'string' ? body.action : '';

    // Owner JWT only — never accept cron secret for these.
    if (
      action === 'mintDatesLink' ||
      action === 'sendMissingDates' ||
      action === 'previewUpcoming' ||
      action === 'sendUpcoming'
    ) {
      await assertOwnerJwt(req);
      await ensureCallbackWebhook();
      db = createServiceClient();
      if (action === 'mintDatesLink') {
        const link = await missingDatesPageLink();
        return jsonResponse({
          ok: true,
          url: link.url,
          expiresAt: link.expiresAt,
        });
      }

      const settingsRows = await db.rest<SettingsRow[]>('telegram_settings', {
        query: { select: '*', id: 'eq.1' },
      });
      const settings = settingsRows[0];
      const tz = settings?.timezone || DEFAULT_FAMILY_TIMEZONE;
      const local = localParts(tz);
      const members = await db.rest<FamilyMemberRow[]>('family_members', {
        query: {
          select:
            'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
          order: 'first_name.asc',
        },
      });

      if (action === 'previewUpcoming') {
        const preview = await previewUpcomingNotice({ db, members, local });
        return jsonResponse(preview);
      }

      if (!settings?.group_chat_id) {
        return jsonResponse({ ok: false, error: 'no_group_chat_id' }, 400);
      }

      if (action === 'sendUpcoming') {
        const result = await maybeSendUpcoming({
          db,
          chatId: settings.group_chat_id,
          members,
          local,
          force: true,
          ownerSend: true,
        });
        return jsonResponse({ ok: result.sent, ...result });
      }

      const result = await maybeSendMissingDates({
        db,
        chatId: settings.group_chat_id,
        members,
        local,
        force: true,
      });
      return jsonResponse({ ok: result.sent, ...result });
    }

    await assertAuthorized(req);
    await ensureCallbackWebhook();

    force = Boolean(body.force);
    trigger = force ? 'test' : 'cron';
    const testPersonId = typeof body.testPersonId === 'string' ? body.testPersonId : null;

    db = createServiceClient();
    const settingsRows = await db.rest<SettingsRow[]>('telegram_settings', {
      query: { select: '*', id: 'eq.1' },
    });
    const settings = settingsRows[0];
    if (!settings) {
      await recordBotRun(db, {
        trigger,
        ok: false,
        summary: {},
        error: 'telegram_settings missing',
        startedAt,
      });
      return jsonResponse({ ok: false, error: 'telegram_settings missing — run migration' }, 500);
    }

    // Stale-run alert before we mark this invocation healthy.
    let healthAlert: { sent: boolean; skipped?: string; hours?: number } | undefined;
    if (settings.group_chat_id) {
      try {
        healthAlert = await maybeSendHealthAlert({
          db,
          chatId: settings.group_chat_id,
          settings,
          force,
        });
      } catch (healthErr) {
        console.error('health alert failed', healthErr);
        healthAlert = {
          sent: false,
          skipped: healthErr instanceof Error ? healthErr.message : String(healthErr),
        };
      }
    }

    if (!settings.enabled && !force) {
      const summary = { skipped: 'disabled', healthAlert };
      await recordBotRun(db, { trigger, ok: true, summary, startedAt });
      return jsonResponse({ ok: true, skipped: 'disabled', healthAlert });
    }
    if (!settings.group_chat_id) {
      const summary = { skipped: 'no_group_chat_id', count: 0 };
      await recordBotRun(db, { trigger, ok: true, summary, startedAt });
      return jsonResponse({ ok: true, skipped: 'no_group_chat_id', count: 0 });
    }

    const tz = settings.timezone || DEFAULT_FAMILY_TIMEZONE;
    const local = localParts(tz);
    // Exact hour match is fragile: GitHub Actions cron is often delayed 10–50+
    // minutes. Once local time reaches send_hour on a birthday day, keep trying
    // later hours the same day. telegram_birthday_sent prevents double posts.
    if (!force && local.hour < settings.send_hour) {
      const summary = {
        skipped: 'before_send_hour',
        localHour: local.hour,
        sendHour: settings.send_hour,
        timezone: tz,
        healthAlert,
      };
      await recordBotRun(db, { trigger, ok: true, summary, startedAt });
      return jsonResponse({
        ok: true,
        skipped: 'before_send_hour',
        localHour: local.hour,
        sendHour: settings.send_hour,
        timezone: tz,
        healthAlert,
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
    const datesUrl = missingCount > 0 ? await missingDatesPageUrl() : null;

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

    let upcoming: { sent: boolean; skipped?: string; count?: number } | undefined;
    try {
      upcoming = await maybeSendUpcoming({
        db,
        chatId: settings.group_chat_id as string,
        members,
        local,
        force,
      });
    } catch (upcomingErr) {
      console.error('upcoming notice failed', upcomingErr);
      upcoming = {
        sent: false,
        skipped: upcomingErr instanceof Error ? upcomingErr.message : String(upcomingErr),
      };
    }

    const payload = {
      ok: true,
      timezone: tz,
      local,
      appUrl: publicAppUrl(),
      count: results.filter((r) => r.group).length,
      results,
      missingDates,
      upcoming,
      healthAlert,
    };
    await recordBotRun(db, {
      trigger,
      ok: true,
      summary: {
        count: payload.count,
        celebrating: results.length,
        missingDates,
        upcoming,
        healthAlert,
      },
      startedAt,
    });
    return jsonResponse(payload);
  } catch (error) {
    console.error(error);
    const msg = error instanceof Error ? error.message : String(error);
    if (db && msg !== 'Unauthorized' && msg !== 'Owner only') {
      await recordBotRun(db, {
        trigger,
        ok: false,
        summary: {},
        error: msg,
        startedAt,
      }).catch((recordErr) => console.warn('record failed run', recordErr));
    }
    const status = msg === 'Unauthorized' || msg === 'Owner only' ? 401 : 500;
    return jsonResponse({ ok: false, error: msg }, status);
  }
});
