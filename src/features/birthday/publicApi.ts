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

/** Living relatives who still need a full birth date (month + day). */
export async function fetchMissingBirthdays(): Promise<MissingBirthdays> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };

  const res = await fetch(`${base}/functions/v1/birthday-public?mode=missing`, {
    headers: publicFnHeaders(anon),
  });
  try {
    const parsed = (await res.json()) as MissingBirthdays;
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
