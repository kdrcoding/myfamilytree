/** Shared helpers for Oq-Ariq Telegram birthday Edge Functions. */

/** Fallback when telegram_settings.timezone is missing — matches the live family clock. */
export const DEFAULT_FAMILY_TIMEZONE = 'Asia/Tashkent';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function telegramApi(
  method: string,
  payload: Record<string, unknown> | FormData,
): Promise<unknown> {
  const token = requireEnv('TELEGRAM_BOT_TOKEN');
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const init: RequestInit =
    payload instanceof FormData
      ? { method: 'POST', body: payload }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        };
  const res = await fetch(url, init);
  const text = await res.text();
  let data: { ok?: boolean; description?: string; result?: unknown };
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Telegram ${method}: non-JSON response (${res.status})`);
  }
  if (!data.ok) {
    console.error('Telegram API error', method, data);
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

let webhookEnsured = false;

/**
 * Docs originally registered only message + my_chat_member, which dropped
 * in-group “Men tabriklayman” taps. Re-apply the webhook when needed.
 */
export async function ensureCallbackWebhook(): Promise<void> {
  if (webhookEnsured) return;
  const secret = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!secret || !supabaseUrl) return;
  const hook = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/telegram-webhook`;
  try {
    const info = (await telegramApi('getWebhookInfo', {})) as {
      url?: string;
      allowed_updates?: string[];
    };
    const allowed = info.allowed_updates ?? [];
    const missingCallback = allowed.length > 0 && !allowed.includes('callback_query');
    if (info.url === hook && !missingCallback) {
      webhookEnsured = true;
      return;
    }
    await telegramApi('setWebhook', {
      url: hook,
      secret_token: secret,
      allowed_updates: ['message', 'my_chat_member', 'callback_query'],
    });
    webhookEnsured = true;
  } catch (error) {
    console.warn('ensureCallbackWebhook failed', error);
  }
}

export type FamilyMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  gender?: 'male' | 'female' | 'unspecified';
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  photo: string | null;
};

export function displayName(m: FamilyMemberRow): string {
  const nick = m.nickname?.trim();
  if (nick) return prettyPersonName(nick);
  return prettyPersonName(`${m.first_name} ${m.last_name}`.trim() || 'Family member');
}

export function prettyPersonName(value: string): string {
  return value.replace(/[A-Z]{2,}[a-z]*/g, (chunk) => {
    const upper = chunk.match(/^[A-Z]+/)?.[0] ?? chunk;
    const rest = chunk.slice(upper.length);
    return upper[0] + upper.slice(1).toLowerCase() + rest;
  });
}

/** Parse YYYY-MM-DD only — same rule as the app birthdays helper. */
export function monthDay(value?: string | null): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Local Y/M/D/H in an IANA timezone. */
export function localParts(timeZone: string, now = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: string;
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday: parts.weekday || '',
  };
}

/** ISO week key for weekly notices, e.g. 2026-W36. */
export function isoWeekPeriod(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const utcDay = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - utcDay);
  const isoYear = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const week = 1 + Math.round((date.getTime() - week1Monday.getTime()) / 604800000);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function ageTurning(
  birth: { year: number; month: number; day: number },
  localYear: number,
): number | null {
  const age = localYear - birth.year;
  return age >= 0 && age < 130 ? age : null;
}

export function isBirthdayToday(
  birth: { month: number; day: number },
  local: { year: number; month: number; day: number },
): boolean {
  // Feb 29 → Feb 28 in non-leap years
  let day = birth.day;
  if (birth.month === 2 && birth.day === 29) {
    const leap = new Date(Date.UTC(local.year, 1, 29)).getUTCDate() === 29;
    if (!leap) day = 28;
  }
  return local.month === birth.month && local.day === day;
}

/** Shift a Y-M-D by whole calendar days (UTC date math, no DST surprises). */
export function shiftLocalDate(
  local: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** Live on the birthday; one extra day as “yesterday”; otherwise closed. */
export function birthdayPagePhase(
  birth: { month: number; day: number },
  local: { year: number; month: number; day: number },
): 'today' | 'yesterday' | 'none' {
  if (isBirthdayToday(birth, local)) return 'today';
  if (isBirthdayToday(birth, shiftLocalDate(local, -1))) return 'yesterday';
  return 'none';
}

/** Storage object path from family_members.photo (not data:/http). */
export function storageObjectPath(photo: string): string | null {
  const raw = photo.trim();
  if (!raw || raw.startsWith('data:') || /^https?:/i.test(raw)) return null;
  let path = raw.replace(/^\/+/, '');
  if (path.startsWith('family-photos/')) path = path.slice('family-photos/'.length);
  return path || null;
}

function encodeObjectPath(path: string): string {
  return path.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

/** Birthday page is live today + yesterday — keep signed URLs valid for that window. */
const PHOTO_SIGN_TTL_SECONDS = 50 * 60 * 60;

function absoluteSignedUrl(baseUrl: string, signed: string): string {
  const s = signed.trim();
  if (/^https?:/i.test(s)) return s;
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('/storage/v1')) return `${baseUrl}${s}`;
  if (s.startsWith('storage/v1')) return `${baseUrl}/${s}`;
  if (s.startsWith('/object/')) return `${baseUrl}/storage/v1${s}`;
  if (s.startsWith('object/')) return `${baseUrl}/storage/v1/${s}`;
  return `${baseUrl}/storage/v1/${s.replace(/^\//, '')}`;
}

export function createServiceClient() {
  const url = requireEnv('SUPABASE_URL').replace(/\/$/, '');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const authHeaders = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };

  async function rest<T>(
    path: string,
    init: RequestInit & { query?: Record<string, string> } = {},
  ): Promise<T> {
    const q = init.query ? '?' + new URLSearchParams(init.query).toString() : '';
    const res = await fetch(`${url}/rest/v1/${path}${q}`, {
      ...init,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        Prefer:
          init.headers && (init.headers as Record<string, string>).Prefer
            ? (init.headers as Record<string, string>).Prefer
            : 'return=representation',
        ...(init.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase REST ${path}: ${res.status} ${text}`);
    }
    // return=minimal / 204 often has an empty body — never call res.json() on that.
    const text = await res.text();
    if (!text || res.status === 204) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`Supabase REST ${path}: invalid JSON (${res.status})`);
    }
  }

  async function signPhoto(path: string): Promise<string | null> {
    const raw = path.trim();
    if (!raw) return null;
    if (/^https?:/i.test(raw)) return raw;
    const objectPath = storageObjectPath(raw);
    if (!objectPath) return null;
    const encoded = encodeObjectPath(objectPath);
    const res = await fetch(`${url}/storage/v1/object/sign/family-photos/${encoded}`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: PHOTO_SIGN_TTL_SECONDS }),
    });
    if (!res.ok) {
      console.error('signPhoto failed', res.status, await res.text(), objectPath);
      return null;
    }
    const text = await res.text();
    if (!text) return null;
    let data: { signedURL?: string; signedUrl?: string };
    try {
      data = JSON.parse(text);
    } catch {
      console.error('signPhoto: invalid JSON');
      return null;
    }
    const signed = data.signedURL || data.signedUrl;
    if (!signed) return null;
    return absoluteSignedUrl(url, signed);
  }

  async function downloadPhotoBytes(photo: string): Promise<Uint8Array | null> {
    const raw = photo.trim();
    if (!raw || raw.startsWith('data:')) return null;

    const tryFetch = async (href: string, headers?: Record<string, string>) => {
      try {
        const res = await fetch(href, headers ? { headers } : undefined);
        if (!res.ok) {
          console.warn('downloadPhotoBytes', res.status, href.slice(0, 96));
          return null;
        }
        const buf = new Uint8Array(await res.arrayBuffer());
        return buf.byteLength > 32 ? buf : null;
      } catch (err) {
        console.warn('downloadPhotoBytes failed', href.slice(0, 96), err);
        return null;
      }
    };

    const objectPath = storageObjectPath(raw);
    if (objectPath) {
      const encoded = encodeObjectPath(objectPath);
      const authenticated = await tryFetch(
        `${url}/storage/v1/object/family-photos/${encoded}`,
        authHeaders,
      );
      if (authenticated) return authenticated;
    }

    if (/^https?:/i.test(raw)) {
      const fromUrl = await tryFetch(raw);
      if (fromUrl) return fromUrl;
    }

    const signed = objectPath ? await signPhoto(raw) : /^https?:/i.test(raw) ? raw : null;
    if (signed) return tryFetch(signed);
    return null;
  }

  return {
    url,
    key,
    rest,
    signPhoto,
    downloadPhotoBytes,
  };
}
