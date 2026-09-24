import { isSupabaseConfigured } from '../../lib/supabase';
import {
  CARD_DESIGNS,
  pickCardDesign,
  type CardDesign,
  type CardGender,
} from './themes';

export type BirthdayWhen = 'today' | 'yesterday';

export type PublicBirthday = {
  ok: boolean;
  error?: string;
  when?: BirthdayWhen;
  design?: CardDesign;
  year?: number;
  person?: {
    id: string;
    name: string;
    gender?: CardGender;
    age: number | null;
    photoUrl: string | null;
    birthMonthDay: string | null;
    wish?: string;
    whoLine?: string | null;
  };
  cheers?: { name: string; username: string | null }[];
  wishes?: { name: string; message: string }[];
};

export type MissingBirthdayPerson = {
  id: string;
  name: string;
  gender?: CardGender | null;
  whoLine?: string | null;
  photoUrl?: string | null;
};

export type MissingBirthdays = {
  ok: boolean;
  error?: string;
  count?: number;
  people?: MissingBirthdayPerson[];
};

export function isCardDesign(value: string | null | undefined): value is CardDesign {
  return CARD_DESIGNS.includes(value as CardDesign);
}

function publicFnHeaders(anon: string): HeadersInit {
  return {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

export async function fetchPublicBirthday(personId: string): Promise<PublicBirthday> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };

  const res = await fetch(
    `${base}/functions/v1/birthday-public?personId=${encodeURIComponent(personId)}`,
    { headers: publicFnHeaders(anon) },
  );
  try {
    const parsed = (await res.json()) as PublicBirthday;
    if (parsed && typeof parsed.ok === 'boolean') return parsed;
  } catch {
    /* HTML / empty gateway body */
  }
  if (res.status === 404) return { ok: false, error: 'not_found' };
  return { ok: false, error: 'failed' };
}

/** Living relatives who still need a full birth date (month + day). Requires Telegram link token. */
export async function fetchMissingBirthdays(linkToken: string): Promise<MissingBirthdays> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };
  const token = normalizeDatesLinkToken(linkToken);
  if (!token) return { ok: false, error: 'unauthorized' };
  if (!looksLikeDatesLinkToken(token)) return { ok: false, error: 'unauthorized' };

  const res = await fetch(
    `${base}/functions/v1/birthday-public?mode=missing&k=${encodeURIComponent(token)}`,
    { headers: publicFnHeaders(anon) },
  );
  try {
    const parsed = (await res.json()) as MissingBirthdays;
    if (parsed && typeof parsed.ok === 'boolean') return parsed;
  } catch {
    /* HTML / empty gateway body */
  }
  if (res.status === 401) return { ok: false, error: 'unauthorized' };
  return { ok: false, error: 'failed' };
}

/** Soft-unlock birth date write — server enforces token + birth_date only. */
export async function setPublicBirthDate(
  personId: string,
  birthDate: string,
  linkToken: string,
  actorName?: string,
): Promise<{ ok: boolean; error?: string }> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };
  const token = normalizeDatesLinkToken(linkToken);
  if (!token) return { ok: false, error: 'unauthorized' };
  if (!looksLikeDatesLinkToken(token)) return { ok: false, error: 'unauthorized' };

  const res = await fetch(`${base}/functions/v1/birthday-public?mode=set-birth`, {
    method: 'POST',
    headers: {
      ...publicFnHeaders(anon),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personId,
      birthDate,
      k: token,
      actorName: actorName?.trim().slice(0, 40) || undefined,
    }),
  });
  try {
    const parsed = (await res.json()) as { ok?: boolean; error?: string };
    if (parsed && typeof parsed.ok === 'boolean') {
      return parsed.ok ? { ok: true } : { ok: false, error: parsed.error || 'failed' };
    }
  } catch {
    /* ignore */
  }
  if (res.status === 401) return { ok: false, error: 'unauthorized' };
  return { ok: false, error: 'failed' };
}

/** Expiry ms from a dates link token (display only — server still verifies). */
export function peekDatesLinkExpiryMs(token: string | null | undefined): number | null {
  const m = /^v1\.(\d{9,12})\./.exec(normalizeDatesLinkToken(token ?? ''));
  if (!m) return null;
  const exp = Number(m[1]);
  return Number.isFinite(exp) ? exp * 1000 : null;
}

/**
 * Clean a copied/pasted `k=` token so spaces, zero-width chars, and junk
 * wrappers do not break a real `v1.<exp>.<sig>` link.
 */
export function normalizeDatesLinkToken(raw: string): string {
  let s = raw.trim();
  if (!s) return '';
  try {
    // Only decode when it looks percent-encoded — avoids throwing on lone %.
    if (/%[0-9A-Fa-f]{2}/.test(s)) s = decodeURIComponent(s);
  } catch {
    /* keep raw */
  }
  s = s
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '')
    .replace(/\s+/g, '')
    .replace(/^['"<([]+|['">)\]]+$/g, '');
  const m = /^(v1\.\d{9,12}\.[A-Za-z0-9_-]{20,100})/.exec(s);
  return m ? m[1]! : s;
}

/** True when the token looks like our signed dates-link format (not verified). */
export function looksLikeDatesLinkToken(token: string | null | undefined): boolean {
  return /^v1\.\d{9,12}\.[A-Za-z0-9_-]{20,100}$/.test(normalizeDatesLinkToken(token ?? ''));
}

export type WebCheerResult = {
  ok: boolean;
  already?: boolean;
  error?: string;
  message?: string;
  cheers?: { name: string; username: string | null }[];
  year?: number;
};

/** Public “Men tabriklayman” from /bday — no login. */
export async function submitPublicCheer(personId: string, name: string): Promise<WebCheerResult> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };

  const res = await fetch(`${base}/functions/v1/birthday-public?mode=cheer`, {
    method: 'POST',
    headers: {
      ...publicFnHeaders(anon),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ personId, name }),
  });
  try {
    const parsed = (await res.json()) as WebCheerResult;
    if (parsed && typeof parsed.ok === 'boolean') return parsed;
  } catch {
    /* HTML / empty gateway body */
  }
  return { ok: false, error: 'failed' };
}

export function isVisiblePhotoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^(https?:|data:image\/)/i.test(url));
}

/** Stable design seed matching the public birthday function / Telegram card. */
export function celebrationDesign(personId: string, year: number): CardDesign {
  return pickCardDesign(`${personId}:${year}`);
}

/** True when birthDate is a full YYYY-MM-DD the bot can post for. */
export function hasFullBirthDate(value?: string | null): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test((value ?? '').trim());
}
