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

export function isCardDesign(value: string | null | undefined): value is CardDesign {
  return CARD_DESIGNS.includes(value as CardDesign);
}

export async function fetchPublicBirthday(personId: string): Promise<PublicBirthday> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon || !isSupabaseConfigured) return { ok: false, error: 'not_configured' };

  const res = await fetch(
    `${base}/functions/v1/birthday-public?personId=${encodeURIComponent(personId)}`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
    },
  );
  try {
    return (await res.json()) as PublicBirthday;
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export function isVisiblePhotoUrl(url: string | null | undefined): boolean {
  return Boolean(url && /^(https?:|data:image\/)/i.test(url));
}

/** Stable design seed matching the public birthday function / Telegram card. */
export function celebrationDesign(personId: string, year: number): CardDesign {
  return pickCardDesign(`${personId}:${year}`);
}
