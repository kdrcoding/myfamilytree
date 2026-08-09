import type { FamilyPerson } from '../types/family';
import type { UpcomingAnniversary } from './anniversaries';
import { getUpcomingAnniversaries } from './anniversaries';
import type { UpcomingBirthday } from './birthdays';
import { getUpcomingBirthdays } from './birthdays';

export type UpcomingCelebration =
  | { kind: 'birthday'; key: string; daysUntil: number; isToday: boolean; birthday: UpcomingBirthday }
  | {
      kind: 'anniversary';
      key: string;
      daysUntil: number;
      isToday: boolean;
      anniversary: UpcomingAnniversary;
    };

/**
 * Birthdays and wedding anniversaries merged into one timeline, soonest first.
 * Deceased / divorced couples stay out (same rules as the source helpers).
 */
export function getUpcomingCelebrations(
  people: FamilyPerson[],
  options: { includeBirthdays?: boolean; now?: Date } = {},
): UpcomingCelebration[] {
  const { includeBirthdays = true, now } = options;
  const birthdays = includeBirthdays ? getUpcomingBirthdays(people, now) : [];
  const anniversaries = getUpcomingAnniversaries(people, now);

  const items: UpcomingCelebration[] = [
    ...birthdays.map((birthday) => ({
      kind: 'birthday' as const,
      key: `bday-${birthday.person.id}`,
      daysUntil: birthday.daysUntil,
      isToday: birthday.isToday,
      birthday,
    })),
    ...anniversaries.map((anniversary) => ({
      kind: 'anniversary' as const,
      key: `anniv-${[anniversary.a.id, anniversary.b.id].sort().join('-')}`,
      daysUntil: anniversary.daysUntil,
      isToday: anniversary.isToday,
      anniversary,
    })),
  ];

  items.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      (a.kind === 'birthday' ? a.birthday.person.firstName : a.anniversary.a.firstName).localeCompare(
        b.kind === 'birthday' ? b.birthday.person.firstName : b.anniversary.a.firstName,
      ),
  );
  return items;
}

/** Prefer items inside the window; if quiet, still show the next few. */
export function windowCelebrations(
  items: UpcomingCelebration[],
  windowDays: number,
  fallbackCount = 5,
): UpcomingCelebration[] {
  const soon = items.filter((c) => c.daysUntil <= windowDays);
  return soon.length > 0 ? soon : items.slice(0, fallbackCount);
}
