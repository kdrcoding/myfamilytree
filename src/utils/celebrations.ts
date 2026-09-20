import type { FamilyPerson } from '../types/family';
import type { UpcomingAnniversary } from './anniversaries';
import { getUpcomingAnniversaries } from './anniversaries';
import type { UpcomingBirthday } from './birthdays';
import { getUpcomingBirthdays } from './birthdays';
import type { CustomTradition, UpcomingTradition } from './traditions';
import { getUpcomingTraditions } from './traditions';
import { isLivingPerson } from './living';

export type UpcomingCelebration =
  | { kind: 'birthday'; key: string; daysUntil: number; isToday: boolean; birthday: UpcomingBirthday }
  | {
      kind: 'anniversary';
      key: string;
      daysUntil: number;
      isToday: boolean;
      anniversary: UpcomingAnniversary;
    }
  | {
      kind: 'tradition';
      key: string;
      daysUntil: number;
      isToday: boolean;
      tradition: UpcomingTradition;
    };

/**
 * Birthdays, wedding anniversaries, and family traditions — soonest first.
 * Deceased people never appear (fail-closed). Traditions never name anyone.
 */
export function getUpcomingCelebrations(
  people: FamilyPerson[],
  options: {
    includeBirthdays?: boolean;
    now?: Date;
    customTraditions?: CustomTradition[];
  } = {},
): UpcomingCelebration[] {
  const { includeBirthdays = true, now, customTraditions = [] } = options;
  const living = people.filter(isLivingPerson);
  const birthdays = includeBirthdays ? getUpcomingBirthdays(living, now) : [];
  const anniversaries = getUpcomingAnniversaries(living, now);
  const traditions = getUpcomingTraditions(customTraditions, now);

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
    ...traditions.map((tradition) => ({
      kind: 'tradition' as const,
      key: `trad-${tradition.id}`,
      daysUntil: tradition.daysUntil,
      isToday: tradition.isToday,
      tradition,
    })),
  ];

  items.sort((a, b) => {
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    const nameA =
      a.kind === 'birthday'
        ? a.birthday.person.firstName
        : a.kind === 'anniversary'
          ? a.anniversary.a.firstName
          : a.tradition.customTitle || a.tradition.kind;
    const nameB =
      b.kind === 'birthday'
        ? b.birthday.person.firstName
        : b.kind === 'anniversary'
          ? b.anniversary.a.firstName
          : b.tradition.customTitle || b.tradition.kind;
    return nameA.localeCompare(nameB);
  });
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
