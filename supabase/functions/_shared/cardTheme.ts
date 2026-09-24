/** Shared birthday-card palettes and design ids (Telegram PNG + public page).
 * Telegram PNG motifs are raster photos in birthdayCard.ts (girls: balloons+flowers,
 * boys: coins+supercar). The public page does not need those pictures.
 */

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
    bgA: '#9f1239',
    bgB: '#e11d48',
    bgC: '#fb7185',
    cardA: '#fff1f2',
    cardB: '#ffe4e6',
    accent: '#be123c',
    accentSoft: '#fb7185',
    ink: '#4c0519',
    muted: '#9f1239',
    confetti: ['#fb7185', '#fbbf24', '#f472b6', '#34d399'],
  },
  male: {
    bgA: '#1e3a8a',
    bgB: '#2563eb',
    bgC: '#38bdf8',
    cardA: '#eff6ff',
    cardB: '#dbeafe',
    accent: '#1d4ed8',
    accentSoft: '#38bdf8',
    ink: '#0f172a',
    muted: '#1e40af',
    confetti: ['#38bdf8', '#fbbf24', '#60a5fa', '#a78bfa'],
  },
  unspecified: {
    bgA: '#047857',
    bgB: '#10b981',
    bgC: '#34d399',
    cardA: '#ecfdf5',
    cardB: '#d1fae5',
    accent: '#059669',
    accentSoft: '#34d399',
    ink: '#022c22',
    muted: '#047857',
    confetti: ['#34d399', '#fbbf24', '#f472b6', '#6ee7b7'],
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

export function cardDesignSeed(personId: string, year: number): string {
  return `${personId}:${year}`;
}
