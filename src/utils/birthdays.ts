import type { FamilyPerson } from '../types/family';

export interface UpcomingBirthday {
  person: FamilyPerson;
  month: number; // 1-12
  day: number; // 1-31
  daysUntil: number; // 0 = today
  isToday: boolean;
  /** Age they turn on this birthday, when the birth year is known. */
  turningAge: number | null;
}

/**
 * Month + day of a birth date — only when BOTH were entered. A year-only
 * ("1980") or year-month ("1980-05") date has no specific day to celebrate,
 * so it is skipped rather than guessed at.
 */
function monthDay(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Reject impossible days (e.g. 02-30) the same way parseDateParts does.
  if (new Date(year, month - 1, day).getDate() !== day) return null;
  return { year, month, day };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Every living family member with a known birthday (month + day), ordered by
 * how soon their next birthday is — today first, then tomorrow, all the way
 * around the year. Deceased people are excluded. A Feb 29 birthday is
 * celebrated on Feb 28 in non-leap years.
 *
 * The full list is returned (not windowed) so the caller can always show the
 * next one even in a quiet stretch, and `now` is injectable for testing.
 */
export function getUpcomingBirthdays(
  people: FamilyPerson[],
  now: Date = new Date(),
): UpcomingBirthday[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const result: UpcomingBirthday[] = [];

  for (const person of people) {
    if (person.isDeceased || person.deathDate) continue;
    const md = monthDay(person.birthDate);
    if (!md) continue;

    const occurrence = (year: number): Date => {
      const day =
        md.month === 2 && md.day === 29 && new Date(year, 1, 29).getDate() !== 29 ? 28 : md.day;
      return new Date(year, md.month - 1, day);
    };

    // The next birthday at or after today.
    let year = today.getFullYear();
    let next = occurrence(year);
    if (next < today) next = occurrence(++year);

    const daysUntil = Math.round((next.getTime() - today.getTime()) / DAY_MS);
    const age = year - md.year;
    result.push({
      person,
      month: md.month,
      day: md.day,
      daysUntil,
      isToday: daysUntil === 0,
      turningAge: age >= 0 && age < 130 ? age : null,
    });
  }

  result.sort(
    (a, b) => a.daysUntil - b.daysUntil || a.person.firstName.localeCompare(b.person.firstName),
  );
  return result;
}
