import type { FamilyPerson } from '../types/family';

/**
 * Living people only — fail closed.
 * Any death flag or death date means they must not appear in celebrations,
 * “who’s next”, or holiday greetings.
 */
export function isLivingPerson(person: FamilyPerson | null | undefined): boolean {
  if (!person) return false;
  if (person.isDeceased) return false;
  if (person.deathDate && String(person.deathDate).trim()) return false;
  return true;
}

export function livingPeopleOnly(people: FamilyPerson[]): FamilyPerson[] {
  return people.filter(isLivingPerson);
}
