import type { FamilyPerson } from '../types/family';
import { isDivorced, marriageDateOf } from './family';

export interface UpcomingAnniversary {
  a: FamilyPerson;
  b: FamilyPerson;
  month: number; // 1-12
  day: number; // 1-31
  daysUntil: number; // 0 = today
  isToday: boolean;
  /** Years married they reach on this anniversary, when the year is known. */
  years: number | null;
  /** Calendar year of the next (or today's) anniversary occurrence. */
  occurrenceYear: number;
}

/**
 * Month + day of a marriage date — only when BOTH were entered, mirroring the
 * birthday rule: a year-only date has no specific day to celebrate.
 */
function monthDay(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (new Date(year, month - 1, day).getDate() !== day) return null;
  return { year, month, day };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Anniversary info for one couple (or null when there is no wedding day to
 * celebrate — missing date, divorced, or a partner has died).
 */
export function getCoupleAnniversary(
  a: FamilyPerson,
  b: FamilyPerson,
  now: Date = new Date(),
): UpcomingAnniversary | null {
  if (a.isDeceased || a.deathDate || b.isDeceased || b.deathDate) return null;
  if (isDivorced(a, b)) return null;
  const md = monthDay(marriageDateOf(a, b));
  if (!md) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const occurrence = (year: number): Date => {
    const day =
      md.month === 2 && md.day === 29 && new Date(year, 1, 29).getDate() !== 29 ? 28 : md.day;
    return new Date(year, md.month - 1, day);
  };

  let year = today.getFullYear();
  let next = occurrence(year);
  if (next < today) next = occurrence(++year);

  const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
  const years = year - md.year;
  return {
    a,
    b,
    month: md.month,
    day: md.day,
    daysUntil,
    isToday: daysUntil === 0,
    years: years > 0 && years < 120 ? years : null,
    occurrenceYear: year,
  };
}

/**
 * Every married couple with a known wedding day (month + day), ordered by how
 * soon their next anniversary is. Divorced couples and couples where either
 * partner has died are excluded — an anniversary is celebrated together.
 * A Feb 29 wedding is celebrated on Feb 28 in non-leap years.
 */
export function getUpcomingAnniversaries(
  people: FamilyPerson[],
  now: Date = new Date(),
): UpcomingAnniversary[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const result: UpcomingAnniversary[] = [];
  const seen = new Set<string>();

  for (const person of people) {
    for (const spouseId of person.spouseIds) {
      const pairKey = [person.id, spouseId].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      const info = getCoupleAnniversary(person, spouse, now);
      if (info) result.push(info);
    }
  }

  result.sort((x, y) => x.daysUntil - y.daysUntil || x.a.firstName.localeCompare(y.a.firstName));
  return result;
}
