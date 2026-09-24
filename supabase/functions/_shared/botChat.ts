/**
 * Private-chat helpers for birthday wishes, identity link, and tree browse.
 */
import {
  ageTurning,
  daysUntilBirthday,
  displayName,
  localParts,
  monthDay,
  prettyPersonName,
  telegramApi,
  DEFAULT_FAMILY_TIMEZONE,
  type FamilyMemberRow,
} from './telegram.ts';
import { whoIsThisUzbek } from './whoIsThis.ts';
import { birthdayPageUrl, publicAppUrl } from './wishes.ts';

export type ServiceDb = {
  rest: <T>(
    path: string,
    init?: RequestInit & { query?: Record<string, string> },
  ) => Promise<T>;
};

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

export type DmState = {
  state: string;
  payload: Record<string, unknown>;
};

export function tgDisplayName(user: TgUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return parts || user.username || `User ${user.id}`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function isBotOwner(userId: number): boolean {
  const raw = Deno.env.get('TELEGRAM_OWNER_IDS') || '';
  const ids = raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return ids.includes(String(userId));
}

/** Same SHA-256 as the website family password / FAMILY_PASSWORD_HASH. */
const DEFAULT_EDITOR_HASH =
  '7fcc57f15a0a35995b1ef5fe78808863346e806aa2b86128c48c0133749c7586';

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  return diff === 0;
}

export async function verifyFamilyPassword(password: string): Promise<boolean> {
  const trimmed = password.trim();
  if (!trimmed || trimmed.length > 200) return false;
  const expected = (Deno.env.get('FAMILY_PASSWORD_HASH') || DEFAULT_EDITOR_HASH).toLowerCase();
  const got = (await sha256Hex(trimmed)).toLowerCase();
  return timingSafeEqual(got, expected);
}

export async function isBotUnlocked(db: ServiceDb, userId: number): Promise<boolean> {
  if (isBotOwner(userId)) return true;
  try {
    const rows = await db.rest<{ telegram_user_id: number }[]>('telegram_bot_unlocks', {
      query: {
        select: 'telegram_user_id',
        telegram_user_id: `eq.${userId}`,
        limit: '1',
      },
    });
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

export async function unlockBot(db: ServiceDb, userId: number): Promise<void> {
  await db.rest('telegram_bot_unlocks', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    query: { on_conflict: 'telegram_user_id' },
    body: JSON.stringify({
      telegram_user_id: userId,
      unlocked_at: new Date().toISOString(),
    }),
  });
}

export async function lockBot(db: ServiceDb, userId: number): Promise<void> {
  try {
    await db.rest('telegram_bot_unlocks', {
      method: 'DELETE',
      query: { telegram_user_id: `eq.${userId}` },
    });
  } catch {
    /* ignore */
  }
}

/** Reply-keyboard labels (exact match when user taps). */
export const MENU = {
  today: '🎂 Bugun',
  week: '📅 Hafta',
  wish: '✍️ Tilak',
  find: '🔎 Topish',
  tree: '🌳 Daraxt',
  me: '👤 Bu men',
  help: 'ℹ️ Yordam',
  status: '📊 Holat',
  test: '🧪 Sinov',
  lock: '🔒 Chiqish',
  admin: '⚙️ Admin',
  back: '◀️ Orqaga',
} as const;

export type MenuAction =
  | 'today'
  | 'week'
  | 'wish'
  | 'find'
  | 'tree'
  | 'me'
  | 'help'
  | 'status'
  | 'test'
  | 'lock'
  | 'admin'
  | 'back';

export function parseMenuAction(text: string): MenuAction | null {
  const t = text.trim();
  for (const [key, label] of Object.entries(MENU) as [MenuAction, string][]) {
    if (t === label) return key;
  }
  return null;
}

export function mainMenuKeyboard(isOwner: boolean): Record<string, unknown> {
  // Family menu stays short; owner gets one Admin button that opens extra options.
  const rows: { text: string }[][] = [
    [{ text: MENU.today }, { text: MENU.week }],
    [{ text: MENU.wish }, { text: MENU.find }],
    [{ text: MENU.me }, { text: MENU.help }],
    [{ text: MENU.lock }],
  ];
  if (isOwner) {
    rows[3] = [{ text: MENU.admin }, { text: MENU.lock }];
  }
  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** Owner-only second page — opens when they tap ⚙️ Admin. */
export function adminMenuKeyboard(): Record<string, unknown> {
  return {
    keyboard: [
      [{ text: MENU.test }, { text: MENU.status }],
      [{ text: MENU.tree }, { text: MENU.help }],
      [{ text: MENU.back }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

export async function sendAdminMenu(chatId: number | string): Promise<void> {
  await sendText(
    chatId,
    [
      '⚙️ <b>Admin</b>',
      '',
      '🧪 Sinov — guruhga sinov xabar',
      '📊 Holat — bot holati',
      '🌳 Daraxt — sayt daraxti',
      '',
      '◀️ Orqaga — asosiy menyu',
    ].join('\n'),
    { reply_markup: adminMenuKeyboard() },
  );
}

export function passwordAskKeyboard(): Record<string, unknown> {
  return { remove_keyboard: true };
}

export async function sendMenu(
  chatId: number | string,
  userId: number,
  message?: string,
  tipHtml?: string,
): Promise<void> {
  const owner = isBotOwner(userId);
  const lines = message
    ? [message]
    : [
        '✅ <b>Oila boti</b>',
        tipHtml || '',
        '',
        '🎂 Bugun · 📅 Hafta · ✍️ Tilak',
        '🔎 Topish · 👤 Bu men · ℹ️ Yordam',
      ].filter((line, i, arr) => !(line === '' && (i === 0 || arr[i - 1] === '')));
  await sendText(chatId, lines.join('\n'), {
    reply_markup: mainMenuKeyboard(owner),
  });
}

export async function askFamilyPassword(chatId: number | string): Promise<void> {
  await sendText(
    chatId,
    [
      '🔐 <b>Oila boti</b>',
      '',
      'Bu shaxsiy chat faqat oila uchun.',
      'Saytdagi <b>oila parolini</b> yuboring (bir marta).',
      '',
      'Egaga parol so‘ralmaydi.',
    ].join('\n'),
    { reply_markup: passwordAskKeyboard() },
  );
}

export async function sendText(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  await telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export async function getDmState(db: ServiceDb, userId: number): Promise<DmState | null> {
  try {
    const rows = await db.rest<{ state: string; payload: Record<string, unknown> }[]>(
      'telegram_dm_state',
      {
        query: {
          select: 'state,payload',
          telegram_user_id: `eq.${userId}`,
          limit: '1',
        },
      },
    );
    const row = rows[0];
    if (!row) return null;
    return {
      state: row.state,
      payload: row.payload && typeof row.payload === 'object' ? row.payload : {},
    };
  } catch {
    return null;
  }
}

export async function setDmState(
  db: ServiceDb,
  userId: number,
  state: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await db.rest('telegram_dm_state', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    query: { on_conflict: 'telegram_user_id' },
    body: JSON.stringify({
      telegram_user_id: userId,
      state,
      payload,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function clearDmState(db: ServiceDb, userId: number): Promise<void> {
  try {
    await db.rest('telegram_dm_state', {
      method: 'DELETE',
      query: { telegram_user_id: `eq.${userId}` },
    });
  } catch {
    /* ignore */
  }
}

export async function loadAllMembers(db: ServiceDb): Promise<FamilyMemberRow[]> {
  return await db.rest<FamilyMemberRow[]>('family_members', {
    query: {
      select: 'id,first_name,last_name,nickname,gender,birth_date,death_date,is_deceased,photo',
      order: 'first_name.asc',
    },
  });
}

export async function loadRels(
  db: ServiceDb,
): Promise<{ kind: string; person_a: string; person_b: string }[]> {
  try {
    return await db.rest('family_relationships', {
      query: { select: 'kind,person_a,person_b' },
    });
  } catch {
    return [];
  }
}

export async function loadSettings(db: ServiceDb): Promise<{
  group_chat_id: string | null;
  bot_username: string | null;
  timezone: string;
  send_hour: number;
  enabled: boolean;
  last_ok_at?: string | null;
  last_run_at?: string | null;
  last_run_ok?: boolean | null;
  last_run_error?: string | null;
}> {
  const rows = await db.rest<
    {
      group_chat_id: string | null;
      bot_username: string | null;
      timezone: string;
      send_hour: number;
      enabled: boolean;
      last_ok_at?: string | null;
      last_run_at?: string | null;
      last_run_ok?: boolean | null;
      last_run_error?: string | null;
    }[]
  >('telegram_settings', {
    query: {
      select:
        'group_chat_id,bot_username,timezone,send_hour,enabled,last_ok_at,last_run_at,last_run_ok,last_run_error',
      id: 'eq.1',
    },
  });
  return (
    rows[0] ?? {
      group_chat_id: null,
      bot_username: null,
      timezone: DEFAULT_FAMILY_TIMEZONE,
      send_hour: 9,
      enabled: false,
    }
  );
}

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['`ʻʼ']/g, '')
    .replace(/[.]/g, ' ')
    .replace(/[^a-z0-9\u0400-\u04ff\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function searchBlob(m: FamilyMemberRow): string {
  const parts = [
    m.first_name,
    m.last_name,
    m.nickname || '',
    `${m.first_name} ${m.last_name}`,
    displayName(m),
  ];
  return normalizeSearch(parts.filter(Boolean).join(' '));
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const mLen = a.length;
  const n = b.length;
  if (Math.abs(mLen - n) > 2) return 99;
  const prev = new Array(n + 1);
  const cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= mLen; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j];
  }
  return prev[n];
}

function tokenScore(haystack: string, token: string): number {
  if (!token || token.length < 2) return 0;
  const words = haystack.split(' ').filter(Boolean);
  if (words.some((w) => w === token)) return 50;
  if (words.some((w) => w.startsWith(token) || token.startsWith(w))) return 35;
  if (haystack.includes(token)) return 22;
  if (token.length >= 4) {
    for (const w of words) {
      if (w.length < 3) continue;
      if (Math.abs(w.length - token.length) > 2) continue;
      if (editDistance(w, token) <= 1) return 18;
    }
  }
  return 0;
}

/**
 * Find people by first/last/nickname. Multi-word queries like
 * "kadir ravshanov" match nickname + last even when displayName is only "Kadir".
 */
export function searchPeople(members: FamilyMemberRow[], query: string, limit = 8): FamilyMemberRow[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return [];
  const tokens = q.split(' ').filter((t) => t.length >= 2);
  if (tokens.length === 0) return [];

  const scored = members
    .filter((m) => !m.is_deceased && !m.death_date)
    .map((m) => {
      const blob = searchBlob(m);
      const first = normalizeSearch(m.first_name);
      const last = normalizeSearch(m.last_name || '');
      const nick = normalizeSearch(m.nickname || '');
      const full = normalizeSearch(`${m.first_name} ${m.last_name}`);
      const shown = normalizeSearch(displayName(m));

      let score = 0;
      if (shown === q || full === q || nick === q || first === q) score += 120;
      else if (shown.startsWith(q) || full.startsWith(q)) score += 90;

      let matchedTokens = 0;
      for (const t of tokens) {
        const s = Math.max(
          tokenScore(blob, t),
          nick === t ? 55 : 0,
          last === t ? 55 : 0,
          first === t ? 50 : 0,
        );
        if (s > 0) {
          matchedTokens++;
          score += s;
        }
      }

      if (tokens.length > 1 && matchedTokens < tokens.length) {
        if (!(matchedTokens >= 2 && score >= 70)) score = 0;
      } else if (tokens.length === 1 && matchedTokens === 0) {
        score = 0;
      }

      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || displayName(a.m).localeCompare(displayName(b.m)));

  return scored.slice(0, limit).map((x) => x.m);
}

/** Short picker label: Nickname · Last (tell similar people apart). */
export function pickLabel(m: FamilyMemberRow): string {
  const nick = m.nickname?.trim();
  const last = m.last_name?.trim();
  const first = m.first_name?.trim();
  if (nick && last) return (`${prettyPersonName(nick)} · ${prettyPersonName(last)}`).slice(0, 40);
  if (nick && first) return (`${prettyPersonName(first)} “${prettyPersonName(nick)}”`).slice(0, 40);
  return displayName(m).slice(0, 40);
}

export function peopleWithBirthdayToday(
  members: FamilyMemberRow[],
  tz: string,
): { person: FamilyMemberRow; age: number | null }[] {
  const local = localParts(tz);
  const out: { person: FamilyMemberRow; age: number | null }[] = [];
  for (const m of members) {
    if (m.is_deceased || m.death_date) continue;
    const md = monthDay(m.birth_date);
    if (!md || md.month !== local.month || md.day !== local.day) continue;
    out.push({ person: m, age: ageTurning(md, local.year) });
  }
  return out;
}

export function peopleBirthdaySoon(
  members: FamilyMemberRow[],
  tz: string,
  withinDays = 7,
): { person: FamilyMemberRow; days: number; age: number | null }[] {
  const local = localParts(tz);
  const out: { person: FamilyMemberRow; days: number; age: number | null }[] = [];
  for (const m of members) {
    if (m.is_deceased || m.death_date) continue;
    const md = monthDay(m.birth_date);
    if (!md) continue;
    const days = daysUntilBirthday(md, local);
    if (days < 0 || days > withinDays) continue;
    const year =
      days === 0
        ? local.year
        : local.month > md.month || (local.month === md.month && local.day > md.day)
          ? local.year + 1
          : local.year;
    out.push({ person: m, days, age: ageTurning(md, year) });
  }
  return out.sort((a, b) => a.days - b.days);
}

/** Human label: bugun / ertaga / N kun */
export function whenInDaysUz(days: number): string {
  if (days <= 0) return 'bugun';
  if (days === 1) return 'ertaga';
  return `${days} kun`;
}

/** Snapshot line for the main menu (what’s happening with birthdays). */
export function birthdayMenuTip(
  members: FamilyMemberRow[],
  tz: string,
): string {
  const today = peopleWithBirthdayToday(members, tz);
  if (today.length === 1) {
    return `🎉 Bugun: <b>${escapeHtml(displayName(today[0]!.person))}</b> — tilak yozish mumkin`;
  }
  if (today.length > 1) {
    return `🎉 Bugun <b>${today.length}</b> ta tug‘ilgan kun — ✍️ Tilak bosing`;
  }
  const soon = peopleBirthdaySoon(members, tz, 14);
  if (soon.length > 0) {
    const n = soon[0]!;
    return `⏭ Keyingi: <b>${escapeHtml(displayName(n.person))}</b> — ${whenInDaysUz(n.days)}`;
  }
  return '🎈 Yaqin tug‘ilgan kun yo‘q — ism bilan tilak yozishingiz mumkin';
}

export function wishStartPayload(personId: string, year: number): string {
  return `wish_${personId}_${year}`;
}

export function parseWishStart(data: string): { personId: string; year: number } | null {
  const m = /^wish_(.+)_(\d{4})$/.exec(data.trim());
  if (!m) return null;
  return { personId: m[1]!, year: Number(m[2]) };
}

export function claimCallbackData(personId: string): string {
  return `claim_${personId}`;
}

export function parseClaimCallback(data: string): string | null {
  const m = /^claim_(.+)$/.exec(data.trim());
  return m?.[1] ?? null;
}

export function findCallbackData(personId: string): string {
  return `find_${personId}`;
}

export function parseFindCallback(data: string): string | null {
  const m = /^find_(.+)$/.exec(data.trim());
  return m?.[1] ?? null;
}

export async function linkPerson(
  db: ServiceDb,
  personId: string,
  user: TgUser,
  chatId: number,
): Promise<void> {
  // One Telegram account → one family person.
  try {
    await db.rest('telegram_person_links', {
      method: 'DELETE',
      query: { telegram_user_id: `eq.${user.id}` },
    });
  } catch {
    /* none */
  }
  await db.rest('telegram_person_links', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    query: { on_conflict: 'person_id' },
    body: JSON.stringify({
      person_id: personId,
      telegram_user_id: user.id,
      chat_id: chatId,
      display_name: tgDisplayName(user),
      linked_at: new Date().toISOString(),
    }),
  });
}

export async function findPersonLink(
  db: ServiceDb,
  personId: string,
): Promise<{ chat_id: number; telegram_user_id: number; display_name: string | null } | null> {
  try {
    const rows = await db.rest<
      { chat_id: number; telegram_user_id: number; display_name: string | null }[]
    >('telegram_person_links', {
      query: {
        select: 'chat_id,telegram_user_id,display_name',
        person_id: `eq.${personId}`,
        limit: '1',
      },
    });
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function saveAndDeliverWish(opts: {
  db: ServiceDb;
  person: FamilyMemberRow;
  year: number;
  from: TgUser;
  message: string;
  groupChatId: string | null;
}): Promise<{ deliveredDm: boolean }> {
  const text = opts.message.trim().slice(0, 500);
  const fromName = tgDisplayName(opts.from);
  const honoree = displayName(opts.person);

  let deliveredDm = false;
  const link = await findPersonLink(opts.db, opts.person.id);
  if (link && link.telegram_user_id !== opts.from.id) {
    try {
      await sendText(
        link.chat_id,
        [
          `🎂 <b>Yangi tilak!</b>`,
          '',
          `<b>${escapeHtml(fromName)}</b> sizga yozdi:`,
          '',
          `<i>${escapeHtml(text)}</i>`,
          '',
          `Bayram sahifasi: ${birthdayPageUrl(opts.person.id)}`,
        ].join('\n'),
      );
      deliveredDm = true;
    } catch (err) {
      console.warn('wish DM failed (blocked or never started bot)', err);
    }
  }

  try {
    await opts.db.rest('telegram_birthday_wishes', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        person_id: opts.person.id,
        year: opts.year,
        from_telegram_user_id: opts.from.id,
        from_display_name: fromName,
        message: text,
        delivered_dm: deliveredDm,
      }),
    });
  } catch (err) {
    console.error('wish insert failed', err);
    throw err;
  }

  if (opts.groupChatId) {
    try {
      await sendText(
        opts.groupChatId,
        [
          `💌 <b>${escapeHtml(fromName)}</b> → <b>${escapeHtml(honoree)}</b>`,
          '',
          escapeHtml(text),
          deliveredDm ? '' : '',
        ]
          .filter((line, i, arr) => !(line === '' && arr[i - 1] === ''))
          .join('\n'),
      );
    } catch (err) {
      console.warn('wish group announce failed', err);
    }
  }

  return { deliveredDm };
}

export function personCardText(
  person: FamilyMemberRow,
  members: FamilyMemberRow[],
  rels: { kind: string; person_a: string; person_b: string }[],
  tz: string,
): string {
  const name = displayName(person);
  const who = whoIsThisUzbek(person, members, rels);
  const md = monthDay(person.birth_date);
  const local = localParts(tz);
  const lines = [`👤 <b>${escapeHtml(name)}</b>`];
  if (who) lines.push(escapeHtml(who));
  if (md) {
    const days = daysUntilBirthday(md, local);
    const age = ageTurning(
      md,
      days === 0
        ? local.year
        : local.month > md.month || (local.month === md.month && local.day > md.day)
          ? local.year + 1
          : local.year,
    );
    if (days === 0) lines.push(`🎂 Bugun tug‘ilgan kuni${age != null ? ` — ${age} yosh` : ''}!`);
    else if (days <= 30) {
      lines.push(
        `📅 ${md.day}.${String(md.month).padStart(2, '0')}${age != null ? ` · ${age} yoshga to‘ladi` : ''} · ${days} kun qoldi`,
      );
    } else {
      lines.push(`📅 ${md.day}.${String(md.month).padStart(2, '0')}`);
    }
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const parents = rels
    .filter((r) => r.kind === 'parent-child' && r.person_b === person.id)
    .map((r) => byId.get(r.person_a))
    .filter(Boolean) as FamilyMemberRow[];
  const kids = rels
    .filter((r) => r.kind === 'parent-child' && r.person_a === person.id)
    .map((r) => byId.get(r.person_b))
    .filter(Boolean) as FamilyMemberRow[];
  const spouses = rels
    .filter((r) => r.kind === 'spouse' && (r.person_a === person.id || r.person_b === person.id))
    .map((r) => byId.get(r.person_a === person.id ? r.person_b : r.person_a))
    .filter(Boolean) as FamilyMemberRow[];

  if (parents.length) {
    lines.push('', `👨‍👩‍👧 Ota-ona: ${parents.map((p) => escapeHtml(displayName(p))).join(', ')}`);
  }
  if (spouses.length) {
    lines.push(`💍 Turmush: ${spouses.map((p) => escapeHtml(displayName(p))).join(', ')}`);
  }
  if (kids.length) {
    lines.push(
      `👶 Farzandlar: ${kids
        .slice(0, 8)
        .map((p) => escapeHtml(displayName(p)))
        .join(', ')}${kids.length > 8 ? '…' : ''}`,
    );
  }

  lines.push('', `🌳 Saytda: ${publicAppUrl().replace(/\/$/, '')}/tree`);
  return lines.join('\n');
}

export function relativeButtons(
  person: FamilyMemberRow,
  members: FamilyMemberRow[],
  rels: { kind: string; person_a: string; person_b: string }[],
): { text: string; callback_data: string }[][] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const ids = new Set<string>();
  for (const r of rels) {
    if (r.kind === 'parent-child' && r.person_b === person.id) ids.add(r.person_a);
    if (r.kind === 'parent-child' && r.person_a === person.id) ids.add(r.person_b);
    if (r.kind === 'spouse' && (r.person_a === person.id || r.person_b === person.id)) {
      ids.add(r.person_a === person.id ? r.person_b : r.person_a);
    }
  }
  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];
  for (const id of [...ids].slice(0, 8)) {
    const m = byId.get(id);
    if (!m) continue;
    const label = displayName(m).slice(0, 28);
    const data = findCallbackData(id);
    if (data.length > 64) continue;
    row.push({ text: label, callback_data: data });
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

export function treeBrowseHelp(): string {
  const site = publicAppUrl().replace(/\/$/, '');
  return [
    '🌳 <b>Oila daraxti</b>',
    '',
    'Bot orqali:',
    '• <code>/find Aziza</code> — odamni topish',
    '• Ism yozing — qidiruv',
    '',
    'To‘liq daraxt (sayt):',
    `${site}/tree`,
    '',
    'Maslahat: avval <code>/men</code> bilan o‘zingizni ulang — tug‘ilgan kuningizda tilaklar shaxsiy keladi.',
  ].join('\n');
}
