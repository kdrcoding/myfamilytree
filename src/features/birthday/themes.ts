/** Mirrors supabase/functions/_shared/cardTheme.ts so the web page matches the Telegram card. */

export type CardGender = 'female' | 'male' | 'unspecified';
export type CardDesign = 'balloons' | 'cake' | 'stars' | 'garden' | 'ribbons';

export const CARD_DESIGNS: CardDesign[] = ['balloons', 'cake', 'stars', 'garden', 'ribbons'];

export type CardPalette = {
  bgA: string;
  bgB: string;
  bgC: string;
  cardA: string;
  cardB: string;
  accent: string;
  accentSoft: string;
  ink: string;
  muted: string;
  confetti: [string, string, string, string];
};

export const CARD_PALETTES: Record<CardGender, CardPalette> = {
  female: {
    bgA: '#be123c',
    bgB: '#fb7185',
    bgC: '#fda4af',
    cardA: '#fff7ed',
    cardB: '#ffe4e6',
    accent: '#e11d48',
    accentSoft: '#fb7185',
    ink: '#881337',
    muted: '#9f1239',
    confetti: ['#fb7185', '#fbbf24', '#f9a8d4', '#34d399'],
  },
  male: {
    bgA: '#1e3a8a',
    bgB: '#3b82f6',
    bgC: '#7dd3fc',
    cardA: '#eff6ff',
    cardB: '#e0f2fe',
    accent: '#2563eb',
    accentSoft: '#38bdf8',
    ink: '#1e3a8a',
    muted: '#1d4ed8',
    confetti: ['#38bdf8', '#3b82f6', '#fbbf24', '#a78bfa'],
  },
  unspecified: {
    bgA: '#065f46',
    bgB: '#10b981',
    bgC: '#6ee7b7',
    cardA: '#fffbeb',
    cardB: '#ecfdf5',
    accent: '#059669',
    accentSoft: '#34d399',
    ink: '#064e3b',
    muted: '#047857',
    confetti: ['#34d399', '#fbbf24', '#f472b6', '#a7f3d0'],
  },
};

export function normalizeCardGender(value: string | null | undefined): CardGender {
  if (value === 'female' || value === 'male') return value;
  return 'unspecified';
}

export function pickCardDesign(seed: string): CardDesign {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash + seed.charCodeAt(i) * (i + 1)) % 1009;
  return CARD_DESIGNS[hash % CARD_DESIGNS.length]!;
}

export const DESIGN_EMOJI: Record<CardDesign, [string, string, string, string]> = {
  balloons: ['🎈', '🎈', '🎉', '✨'],
  cake: ['🎂', '🧁', '🍓', '✨'],
  stars: ['⭐', '✨', '🌟', '💫'],
  garden: ['🌸', '🌺', '🌼', '🌷'],
  ribbons: ['🎁', '🎀', '🎊', '💛'],
};

const FEMALE_EMOJI: Record<CardDesign, [string, string, string, string]> = {
  balloons: ['🎈', '🌸', '🎈', '🌷'],
  cake: ['🎂', '🌸', '🎈', '🌺'],
  stars: ['⭐', '🌸', '🎈', '🌷'],
  garden: ['🌸', '🎈', '🌺', '🌷'],
  ribbons: ['🎁', '🌸', '🎈', '🎀'],
};

const MALE_EMOJI: Record<CardDesign, [string, string, string, string]> = {
  balloons: ['💵', '🚗', '💰', '🚘'],
  cake: ['🎂', '💵', '🚗', '💰'],
  stars: ['⭐', '💵', '🚗', '🚘'],
  garden: ['💵', '🚗', '💰', '🚘'],
  ribbons: ['🎁', '💵', '🚗', '💰'],
};

/** Extra party stickers layered on the web celebration (not the Telegram PNG). */
export function partyStickers(gender: CardGender): string[] {
  if (gender === 'female') {
    return ['🎈', '🌸', '🎂', '🎁', '🥳', '✨', '🌷', '🎉', '💖', '🧁', '🎀', '🌺'];
  }
  if (gender === 'male') {
    return ['🎉', '🎂', '🚗', '🎈', '🥳', '✨', '🎁', '💵', '🎊', '⭐', '🧁', '💙'];
  }
  return ['🎉', '🎂', '🎈', '🥳', '✨', '🎁', '🎊', '⭐', '🧁', '💚', '🌼', '💛'];
}

/** Floating motifs on the public page — matches the Telegram PNG. */
export function designEmoji(
  design: CardDesign,
  gender: CardGender,
): [string, string, string, string] {
  if (gender === 'female') return FEMALE_EMOJI[design];
  if (gender === 'male') return MALE_EMOJI[design];
  return DESIGN_EMOJI[design];
}

export function birthdayPalette(gender: CardGender) {
  return CARD_PALETTES[gender];
}
