import type { FamilyPerson, RelationLink } from '../types/family';
import { birthYear } from './dates';

export type PersonIndex = Map<string, FamilyPerson>;

export function buildIndex(people: FamilyPerson[]): PersonIndex {
  return new Map(people.map((p) => [p.id, p]));
}

/** People with no recorded parents whose spouses also have no recorded parents. */
export function findFounders(people: FamilyPerson[]): FamilyPerson[] {
  const index = buildIndex(people);
  const founders = people.filter(
    (p) =>
      p.parentIds.length === 0 &&
      (p.spouseIds.length === 0 ||
        p.spouseIds.every((sid) => (index.get(sid)?.parentIds.length ?? 0) === 0)),
  );
  return founders.length > 0 ? founders : people.filter((p) => p.parentIds.length === 0);
}

/**
 * Assign a generation number to every person. Founders are generation 1,
 * children are one generation below their parents, and spouses share their
 * partner's generation. Unreachable people default to generation 1.
 */
export function computeGenerations(people: FamilyPerson[]): Map<string, number> {
  const index = buildIndex(people);
  const generations = new Map<string, number>();
  const queue: string[] = [];

  for (const founder of findFounders(people)) {
    if (!generations.has(founder.id)) {
      generations.set(founder.id, 1);
      queue.push(founder.id);
    }
  }

  // No valid tree has more generations than people; the cap keeps a
  // parent-child cycle in imported/remote data from looping forever.
  const maxGen = Math.max(people.length, 1);

  while (queue.length > 0) {
    const id = queue.shift()!;
    const person = index.get(id);
    if (!person) continue;
    const gen = generations.get(id)!;
    for (const spouseId of person.spouseIds) {
      // Spouses share the higher of the couple's generations, so a partner
      // bumped later by a longer parent path drags the other one along.
      if (index.has(spouseId) && (generations.get(spouseId) ?? 0) < gen) {
        generations.set(spouseId, gen);
        queue.push(spouseId);
      }
    }
    for (const childId of person.childIds) {
      if (index.has(childId)) {
        const next = gen + 1;
        if (next <= maxGen && (!generations.has(childId) || generations.get(childId)! < next)) {
          generations.set(childId, next);
          queue.push(childId);
        }
      }
    }
  }

  for (const person of people) {
    if (!generations.has(person.id)) generations.set(person.id, 1);
  }
  return generations;
}

/** Ids of founders plus everyone descended from them ("blood line"). */
export function computeBloodline(people: FamilyPerson[]): Set<string> {
  const index = buildIndex(people);
  const blood = new Set<string>();
  const queue = findFounders(people).map((p) => p.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (blood.has(id)) continue;
    blood.add(id);
    for (const childId of index.get(id)?.childIds ?? []) queue.push(childId);
  }
  return blood;
}

export function getDescendantIds(id: string, index: PersonIndex): Set<string> {
  const result = new Set<string>();
  const queue = [...(index.get(id)?.childIds ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (result.has(next)) continue;
    result.add(next);
    for (const childId of index.get(next)?.childIds ?? []) queue.push(childId);
  }
  return result;
}

export function getAncestorIds(id: string, index: PersonIndex): Set<string> {
  const result = new Set<string>();
  const queue = [...(index.get(id)?.parentIds ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (result.has(next)) continue;
    result.add(next);
    for (const parentId of index.get(next)?.parentIds ?? []) queue.push(parentId);
  }
  return result;
}

export interface RelationDescriptor {
  marriedIn: boolean;
  generation: number;
}

/**
 * Language-neutral relationship to the original couple; the UI translates it
 * (founder / child / grandchild / married-in) via the active language.
 */
export function relationshipDescriptor(
  person: FamilyPerson,
  generations: Map<string, number>,
  bloodline: Set<string>,
): RelationDescriptor {
  return {
    marriedIn: !bloodline.has(person.id),
    generation: generations.get(person.id) ?? 1,
  };
}

/** Best available name: "First Last", falling back to the nickname. */
export function fullName(person: FamilyPerson): string {
  const name = `${person.firstName} ${person.lastName}`.trim();
  return name || person.nickname?.trim() || 'Unnamed';
}

export function displayName(person: FamilyPerson): string {
  const name = `${person.firstName} ${person.lastName}`.trim();
  if (!name) return person.nickname?.trim() || 'Unnamed';
  return person.nickname
    ? `${person.firstName} "${person.nickname}" ${person.lastName}`.trim()
    : name;
}

export function initials(person: FamilyPerson): string {
  const source = `${person.firstName} ${person.lastName}`.trim() || person.nickname?.trim() || '';
  const parts = source.split(/\s+/).filter(Boolean).slice(0, 2);
  const chars = parts.map((word) => word.charAt(0)).join('');
  return chars.toUpperCase() || '?';
}

export function sortByBirth(a: FamilyPerson, b: FamilyPerson): number {
  const ya = birthYear(a.birthDate) ?? 9999;
  const yb = birthYear(b.birthDate) ?? 9999;
  return ya - yb || a.firstName.localeCompare(b.firstName);
}

// ---------------------------------------------------------------------------
// Pure mutation helpers. Every helper returns a NEW array and keeps both sides
// of each relationship synchronized (spouse <-> spouse, parent <-> child).
// ---------------------------------------------------------------------------

function clone(person: FamilyPerson): FamilyPerson {
  return {
    ...person,
    parentIds: [...person.parentIds],
    spouseIds: [...person.spouseIds],
    childIds: [...person.childIds],
  };
}

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
}

export function linkSpouses(people: FamilyPerson[], aId: string, bId: string): FamilyPerson[] {
  if (aId === bId) return people;
  return people.map((p) => {
    if (p.id === aId) return { ...clone(p), spouseIds: addUnique(p.spouseIds, bId) };
    if (p.id === bId) return { ...clone(p), spouseIds: addUnique(p.spouseIds, aId) };
    return p;
  });
}

export function linkParentChild(
  people: FamilyPerson[],
  parentId: string,
  childId: string,
): FamilyPerson[] {
  if (parentId === childId) return people;
  return people.map((p) => {
    if (p.id === parentId) return { ...clone(p), childIds: addUnique(p.childIds, childId) };
    if (p.id === childId) return { ...clone(p), parentIds: addUnique(p.parentIds, parentId) };
    return p;
  });
}

/** Remove every reference to `id` from other people's relationship arrays. */
export function stripReferences(people: FamilyPerson[], id: string): FamilyPerson[] {
  return people.map((p) => {
    if (!p.parentIds.includes(id) && !p.spouseIds.includes(id) && !p.childIds.includes(id)) {
      return p;
    }
    return {
      ...clone(p),
      parentIds: p.parentIds.filter((x) => x !== id),
      spouseIds: p.spouseIds.filter((x) => x !== id),
      childIds: p.childIds.filter((x) => x !== id),
    };
  });
}

export function removePerson(people: FamilyPerson[], id: string): FamilyPerson[] {
  return stripReferences(
    people.filter((p) => p.id !== id),
    id,
  );
}

/**
 * Replace a person's relationships with the given sets, updating the inverse
 * side of every added or removed relationship.
 */
export function setRelationships(
  people: FamilyPerson[],
  personId: string,
  parentIds: string[],
  spouseIds: string[],
): FamilyPerson[] {
  const current = people.find((p) => p.id === personId);
  if (!current) return people;

  let next = people;
  for (const oldParent of current.parentIds) {
    if (!parentIds.includes(oldParent)) {
      next = next.map((p) =>
        p.id === oldParent
          ? { ...clone(p), childIds: p.childIds.filter((x) => x !== personId) }
          : p.id === personId
            ? { ...clone(p), parentIds: p.parentIds.filter((x) => x !== oldParent) }
            : p,
      );
    }
  }
  for (const oldSpouse of current.spouseIds) {
    if (!spouseIds.includes(oldSpouse)) {
      next = next.map((p) =>
        p.id === oldSpouse
          ? { ...clone(p), spouseIds: p.spouseIds.filter((x) => x !== personId) }
          : p.id === personId
            ? { ...clone(p), spouseIds: p.spouseIds.filter((x) => x !== oldSpouse) }
            : p,
      );
    }
  }
  for (const parentId of parentIds) next = linkParentChild(next, parentId, personId);
  for (const spouseId of spouseIds) next = linkSpouses(next, personId, spouseId);
  return next;
}

/** Attach a freshly created person to an existing one. */
export function applyRelationLink(
  people: FamilyPerson[],
  newPersonId: string,
  link: RelationLink,
): FamilyPerson[] {
  const target = people.find((p) => p.id === link.targetId);
  if (!target) return people;
  switch (link.kind) {
    case 'spouse':
      return linkSpouses(people, newPersonId, link.targetId);
    case 'child': {
      // Link to the target and to the chosen other parent. When no explicit
      // choice was made, default to the target's first spouse; `null` means
      // the child has only one recorded parent.
      let next = linkParentChild(people, link.targetId, newPersonId);
      const secondParentId =
        link.secondParentId === undefined
          ? target.spouseIds[0]
          : (link.secondParentId ?? undefined);
      if (secondParentId && secondParentId !== link.targetId) {
        next = linkParentChild(next, secondParentId, newPersonId);
      }
      return next;
    }
    case 'parent':
      return linkParentChild(people, newPersonId, link.targetId);
    case 'sibling': {
      let next = people;
      for (const parentId of target.parentIds) {
        next = linkParentChild(next, parentId, newPersonId);
      }
      return next;
    }
  }
}

/**
 * Merge an edit from a restricted "family editor": only MISSING information
 * may be filled in. Existing names, dates, details, photos and all
 * relationships are kept exactly as they were — additions only, never
 * overwrites, never deletions.
 */
export function mergeAdditiveEdit(existing: FamilyPerson, updates: FamilyPerson): FamilyPerson {
  const fill = (oldValue: string | undefined, newValue: string | undefined): string | undefined =>
    oldValue?.trim() ? oldValue : newValue;
  return {
    ...existing,
    firstName: existing.firstName.trim() ? existing.firstName : updates.firstName,
    lastName: existing.lastName.trim() ? existing.lastName : updates.lastName,
    nickname: fill(existing.nickname, updates.nickname),
    gender: existing.gender === 'unspecified' ? updates.gender : existing.gender,
    birthDate: fill(existing.birthDate, updates.birthDate),
    deathDate: fill(existing.deathDate, updates.deathDate),
    // A living person can be marked deceased (new information), never the reverse.
    isDeceased: existing.isDeceased || updates.isDeceased,
    photo: fill(existing.photo, updates.photo),
    city: fill(existing.city, updates.city),
    country: fill(existing.country, updates.country),
    occupation: fill(existing.occupation, updates.occupation),
    biography: fill(existing.biography, updates.biography),
  };
}

/**
 * Repair imported data: drop references to people who do not exist and make
 * every relationship symmetric.
 */
export function normalizePeople(people: FamilyPerson[]): FamilyPerson[] {
  const ids = new Set(people.map((p) => p.id));
  let next: FamilyPerson[] = people.map((p) => ({
    ...clone(p),
    parentIds: [...new Set(p.parentIds.filter((id) => ids.has(id) && id !== p.id))],
    spouseIds: [...new Set(p.spouseIds.filter((id) => ids.has(id) && id !== p.id))],
    childIds: [...new Set(p.childIds.filter((id) => ids.has(id) && id !== p.id))],
  }));
  for (const person of next) {
    for (const spouseId of person.spouseIds) next = linkSpouses(next, person.id, spouseId);
    for (const childId of person.childIds) next = linkParentChild(next, person.id, childId);
    for (const parentId of person.parentIds) next = linkParentChild(next, parentId, person.id);
  }
  return next;
}

export function generatePersonId(
  firstName: string,
  lastName: string,
  existing: Set<string>,
): string {
  const base =
    `${firstName}-${lastName}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'person';
  if (!existing.has(base)) return base;
  let n = 2;
  while (existing.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
