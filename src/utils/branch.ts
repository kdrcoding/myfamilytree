import type { FamilyPerson } from '../types/family';
import type { PersonIndex } from './family';
import { getDescendantIds } from './family';

/**
 * Person + all descendants + spouses married into that branch.
 * Used by "Focus branch" on the tree.
 */
export function getBranchMemberIds(rootId: string, index: PersonIndex): Set<string> {
  const ids = new Set<string>([rootId, ...getDescendantIds(rootId, index)]);
  for (const id of [...ids]) {
    const person = index.get(id);
    if (!person) continue;
    for (const spouseId of person.spouseIds) {
      if (index.has(spouseId)) ids.add(spouseId);
    }
  }
  return ids;
}

export function filterBranchPeople(
  people: FamilyPerson[],
  rootId: string | null,
  index: PersonIndex,
): FamilyPerson[] {
  if (!rootId || !index.has(rootId)) return people;
  const allowed = getBranchMemberIds(rootId, index);
  return people.filter((p) => allowed.has(p.id));
}
