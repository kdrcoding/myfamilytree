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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result: UpcomingAnniversary[] = [];
  const seen = new Set<string>();

  for (const person of people) {
    for (const spouseId of person.spouseIds) {
      const pairKey = [person.id, spouseId].sort().join('|');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      if (person.isDeceased || person.deathDate || spouse.isDeceased || spouse.deathDate) continue;
      if (isDivorced(person, spouse)) continue;
      const md = monthDay(marriageDateOf(person, spouse));
      if (!md) continue;

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
      result.push({
        a: person,
        b: spouse,
        month: md.month,
        day: md.day,
        daysUntil,
        isToday: daysUntil === 0,
        years: years > 0 && years < 120 ? years : null,
      });
    }
  }

  result.sort((x, y) => x.daysUntil - y.daysUntil || x.a.firstName.localeCompare(y.a.firstName));
  return result;
}
