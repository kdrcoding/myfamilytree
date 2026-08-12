/** Shared helpers for Oq-Ariq Telegram birthday Edge Functions. */

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

export type FamilyMemberRow = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  photo: string | null;
};

export function displayName(m: FamilyMemberRow): string {
  const nick = m.nickname?.trim();
  if (nick) return nick;
  return `${m.first_name} ${m.last_name}`.trim() || 'Family member';
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
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
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

export function createServiceClient() {
  const url = requireEnv('SUPABASE_URL');
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  // Lazy import-style via global fetch REST — keep zero npm deps in shared.
  return {
    url,
    key,
    async rest<T>(
      path: string,
      init: RequestInit & { query?: Record<string, string> } = {},
    ): Promise<T> {
      const q = init.query
        ? '?' + new URLSearchParams(init.query).toString()
        : '';
      const res = await fetch(`${url}/rest/v1/${path}${q}`, {
        ...init,
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: init.headers && (init.headers as Record<string, string>).Prefer
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
    },
    async signPhoto(path: string): Promise<string | null> {
      if (!path || path.startsWith('data:') || /^https?:/i.test(path)) {
        return path && /^https?:/i.test(path) ? path : null;
      }
      const res = await fetch(`${url}/storage/v1/object/sign/family-photos/${path}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 * 60 }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const signed = data.signedURL || data.signedUrl;
      if (!signed) return null;
      return signed.startsWith('http') ? signed : `${url}/storage/v1${signed}`;
    },
  };
}
