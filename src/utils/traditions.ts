/**
 * Family traditions calendar — joyful holidays & reunions (not birthdays).
 * Never tied to individual people, so deceased relatives are never named.
 */

export type TraditionKind = 'navruz' | 'eid_fitr' | 'eid_adha' | 'new_year' | 'reunion';

export type CustomTradition = {
  id: string;
  title: string;
  /** YYYY-MM-DD — one-off reunion / custom gathering. */
  date: string;
};

export type UpcomingTradition = {
  id: string;
  kind: TraditionKind;
  /** i18n key for built-in title, or empty when custom title is used. */
  titleKey: string;
  /** Custom title (reunions). */
  customTitle?: string;
  month: number;
  day: number;
  year: number;
  daysUntil: number;
  isToday: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Published civil dates for Eid (approx. — moon sighting can shift ±1 day). */
const EID_FITR: Record<number, [number, number]> = {
  2025: [3, 30],
  2026: [3, 20],
  2027: [3, 9],
  2028: [2, 26],
  2029: [2, 14],
  2030: [2, 4],
  2031: [1, 24],
  2032: [1, 14],
};

const EID_ADHA: Record<number, [number, number]> = {
  2025: [6, 6],
  2026: [5, 27],
  2027: [5, 16],
  2028: [5, 5],
  2029: [4, 24],
  2030: [4, 13],
  2031: [4, 3],
  2032: [3, 22],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseYmd(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (new Date(year, month - 1, day).getDate() !== day) return null;
  return { year, month, day };
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function nextRecurring(month: number, day: number, today: Date): { year: number; daysUntil: number } {
  let year = today.getFullYear();
  let next = new Date(year, month - 1, day);
  if (next < today) {
    year += 1;
    next = new Date(year, month - 1, day);
  }
  return { year, daysUntil: daysBetween(today, next) };
}

function eidOccurrence(
  table: Record<number, [number, number]>,
  today: Date,
): { year: number; month: number; day: number; daysUntil: number } | null {
  const y0 = today.getFullYear();
  for (const y of [y0 - 1, y0, y0 + 1, y0 + 2]) {
    const md = table[y];
    if (!md) continue;
    const next = new Date(y, md[0] - 1, md[1]);
    const daysUntil = daysBetween(today, next);
    if (daysUntil >= 0) {
      return { year: y, month: md[0], day: md[1], daysUntil };
    }
  }
  return null;
}

/**
 * Built-in joyful traditions + owner custom reunions.
 * No person names — safe for the whole living family.
 */
export function getUpcomingTraditions(
  custom: CustomTradition[] = [],
  now: Date = new Date(),
): UpcomingTradition[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const items: UpcomingTradition[] = [];

  const navruz = nextRecurring(3, 21, today);
  items.push({
    id: `navruz-${navruz.year}`,
    kind: 'navruz',
    titleKey: 'tradition.navruz',
    month: 3,
    day: 21,
    year: navruz.year,
    daysUntil: navruz.daysUntil,
    isToday: navruz.daysUntil === 0,
  });

  const newYear = nextRecurring(1, 1, today);
  items.push({
    id: `new_year-${newYear.year}`,
    kind: 'new_year',
    titleKey: 'tradition.newYear',
    month: 1,
    day: 1,
    year: newYear.year,
    daysUntil: newYear.daysUntil,
    isToday: newYear.daysUntil === 0,
  });

  const fitr = eidOccurrence(EID_FITR, today);
  if (fitr) {
    items.push({
      id: `eid_fitr-${fitr.year}`,
      kind: 'eid_fitr',
      titleKey: 'tradition.eidFitr',
      month: fitr.month,
      day: fitr.day,
      year: fitr.year,
      daysUntil: fitr.daysUntil,
      isToday: fitr.daysUntil === 0,
    });
  }

  const adha = eidOccurrence(EID_ADHA, today);
  if (adha) {
    items.push({
      id: `eid_adha-${adha.year}`,
      kind: 'eid_adha',
      titleKey: 'tradition.eidAdha',
      month: adha.month,
      day: adha.day,
      year: adha.year,
      daysUntil: adha.daysUntil,
      isToday: adha.daysUntil === 0,
    });
  }

  for (const row of custom) {
    const title = row.title?.trim().slice(0, 80);
    const md = parseYmd(row.date);
    if (!title || !md) continue;
    const next = new Date(md.year, md.month - 1, md.day);
    const daysUntil = daysBetween(today, next);
    if (daysUntil < 0) continue; // past one-off reunions drop off
    items.push({
      id: `reunion-${row.id}`,
      kind: 'reunion',
      titleKey: '',
      customTitle: title,
      month: md.month,
      day: md.day,
      year: md.year,
      daysUntil,
      isToday: daysUntil === 0,
    });
  }

  items.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      a.month - b.month ||
      a.day - b.day ||
      a.id.localeCompare(b.id),
  );
  return items;
}

export function traditionWishKey(kind: TraditionKind): string {
  if (kind === 'navruz') return 'tradition.wishNavruz';
  if (kind === 'eid_fitr') return 'tradition.wishEidFitr';
  if (kind === 'eid_adha') return 'tradition.wishEidAdha';
  if (kind === 'new_year') return 'tradition.wishNewYear';
  return 'tradition.wishReunion';
}

export function traditionNotifyKey(t: UpcomingTradition): string {
  return `${t.id}:${t.year}-${pad2(t.month)}-${pad2(t.day)}`;
}

export function isCustomTraditionList(value: unknown): value is CustomTradition[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (row) =>
      row &&
      typeof row === 'object' &&
      typeof (row as CustomTradition).id === 'string' &&
      typeof (row as CustomTradition).title === 'string' &&
      typeof (row as CustomTradition).date === 'string',
  );
}
