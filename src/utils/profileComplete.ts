import type { FamilyPerson } from '../types/family';

function filled(value?: string | null): boolean {
  return Boolean(value && value.trim());
}

/** At least a birth year (YYYY, YYYY-MM, or YYYY-MM-DD). */
export function hasBirthYear(value?: string | null): boolean {
  return /^\d{4}(-\d{2}(-\d{2})?)?$/.test((value ?? '').trim());
}

/**
 * “Looking complete” on the tree — not every field, just the important ones:
 * name + birth year + photo + at least one life detail.
 */
export function isProfileComplete(person: FamilyPerson): boolean {
  const hasName =
    filled(person.firstName) || filled(person.lastName) || filled(person.nickname);
  if (!hasName) return false;
  if (!hasBirthYear(person.birthDate)) return false;
  if (!filled(person.photo)) return false;

  const hasLifeDetail =
    person.gender !== 'unspecified' ||
    filled(person.city) ||
    filled(person.country) ||
    filled(person.occupation) ||
    filled(person.nickname) ||
    filled(person.biography);

  return hasLifeDetail;
}
