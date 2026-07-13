import type { FamilyData, FamilyPerson, Gender, RelationKind, RelationLink } from '../types/family';
import { FAMILY_DATA_VERSION, JOIN_REQUEST_TYPE } from '../types/family';
import { isValidDateString, toDate } from './dates';
import { buildIndex, getAncestorIds, getDescendantIds } from './family';

const GENDERS: Gender[] = ['male', 'female', 'unspecified'];

export interface PersonFormValues {
  firstName: string;
  lastName: string;
  nickname: string;
  gender: Gender;
  birthDate: string;
  deathDate: string;
  isDeceased: boolean;
  photo: string;
  city: string;
  country: string;
  occupation: string;
  biography: string;
}

/**
 * Field-level validation for the add/edit form. Returns an empty map when
 * valid. Values are translation keys — render them through t().
 */
export function validatePersonForm(values: PersonFormValues): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};
  // Names are flexible: any single one of first name, last name or nickname
  // is enough to add a person.
  if (!values.firstName.trim() && !values.lastName.trim() && !values.nickname.trim()) {
    errors.firstName = 'val.nameRequired';
  }
  if (values.birthDate && !isValidDateString(values.birthDate)) {
    errors.birthDate = 'val.dateFormat';
  }
  if (values.deathDate && !isValidDateString(values.deathDate)) {
    errors.deathDate = 'val.dateFormat';
  }
  if (!errors.birthDate && !errors.deathDate && values.birthDate && values.deathDate) {
    const born = toDate(values.birthDate);
    const died = toDate(values.deathDate);
    if (born && died && died < born) errors.deathDate = 'val.deathBeforeBirth';
  }
  if (values.deathDate && !values.isDeceased) {
    errors.deathDate = 'val.deathNeedsDeceased';
  }
  return errors;
}

/**
 * Check whether linking two existing people is possible.
 * Returns a translation key describing the problem, or null when allowed.
 */
export function canLink(
  people: FamilyPerson[],
  kind: 'spouse' | 'parent-child',
  aId: string,
  bId: string,
): string | null {
  if (aId === bId) return 'val.relSelf';
  const index = buildIndex(people);
  const a = index.get(aId);
  const b = index.get(bId);
  if (!a || !b) return 'val.relUnknown';

  if (kind === 'spouse') {
    if (a.parentIds.includes(bId) || b.parentIds.includes(aId)) {
      return 'val.relParentSpouse';
    }
    return null;
  }

  // parent-child: a is the parent, b is the child.
  if (a.parentIds.includes(bId)) return 'val.relGrandparent';
  if (a.spouseIds.includes(bId)) return 'val.relSpouseChild';
  if (b.childIds.length > 0 && getDescendantIds(bId, index).has(aId)) {
    return 'val.relCycle';
  }
  if (getAncestorIds(aId, index).has(bId)) {
    return 'val.relCycle';
  }
  if (b.parentIds.length >= 2 && !b.parentIds.includes(aId)) {
    return 'val.relTwoParents';
  }
  return null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === 'string');
}

function validatePersonShape(
  value: unknown,
  position: number,
  errors: string[],
): value is FamilyPerson {
  if (typeof value !== 'object' || value === null) {
    errors.push(`Person #${position + 1} is not an object.`);
    return false;
  }
  const p = value as Record<string, unknown>;
  const where = typeof p.id === 'string' && p.id ? `"${p.id}"` : `#${position + 1}`;
  let ok = true;
  if (typeof p.id !== 'string' || !p.id.trim()) {
    errors.push(`Person ${where}: missing or empty "id".`);
    ok = false;
  }
  if (typeof p.firstName !== 'string' || typeof p.lastName !== 'string') {
    errors.push(`Person ${where}: "firstName" and "lastName" must be strings.`);
    ok = false;
  }
  if (!GENDERS.includes(p.gender as Gender)) {
    errors.push(`Person ${where}: "gender" must be male, female or unspecified.`);
    ok = false;
  }
  if (typeof p.isDeceased !== 'boolean') {
    errors.push(`Person ${where}: "isDeceased" must be true or false.`);
    ok = false;
  }
  for (const key of ['parentIds', 'spouseIds', 'childIds']) {
    if (!isStringArray(p[key])) {
      errors.push(`Person ${where}: "${key}" must be an array of ids.`);
      ok = false;
    }
  }
  for (const key of ['birthDate', 'deathDate']) {
    const v = p[key];
    if (v !== undefined && v !== null && (typeof v !== 'string' || !isValidDateString(v))) {
      errors.push(`Person ${where}: "${key}" must be YYYY, YYYY-MM or YYYY-MM-DD.`);
      ok = false;
    }
  }
  return ok;
}

const RELATION_KINDS: RelationKind[] = ['spouse', 'child', 'parent', 'sibling'];

export interface JoinRequestResult {
  /** True when the file is a join request at all (valid or not). */
  isJoinRequest: boolean;
  ok: boolean;
  errors: string[];
  person?: FamilyPerson;
  link?: RelationLink;
}

/** Validate a parsed JSON value as an "Add yourself" join request. */
export function validateJoinRequest(value: unknown): JoinRequestResult {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as Record<string, unknown>).type !== JOIN_REQUEST_TYPE
  ) {
    return { isJoinRequest: false, ok: false, errors: [] };
  }
  const v = value as Record<string, unknown>;
  const errors: string[] = [];
  const okPerson = validatePersonShape(v.person, 0, errors);

  let link: RelationLink | undefined;
  if (v.link !== undefined && v.link !== null) {
    const l = v.link as Record<string, unknown>;
    if (typeof l.targetId === 'string' && RELATION_KINDS.includes(l.kind as RelationKind)) {
      link = {
        kind: l.kind as RelationKind,
        targetId: l.targetId,
        secondParentId:
          typeof l.secondParentId === 'string'
            ? l.secondParentId
            : l.secondParentId === null
              ? null
              : undefined,
      };
    } else {
      errors.push('The connection information in this request file is invalid.');
    }
  }

  if (!okPerson || errors.length > 0) {
    return { isJoinRequest: true, ok: false, errors };
  }
  const person = v.person as FamilyPerson;
  return {
    isJoinRequest: true,
    ok: true,
    errors: [],
    // Relationships are established through the link, never trusted from the file.
    person: { ...person, parentIds: [], spouseIds: [], childIds: [] },
    link,
  };
}

export interface ImportResult {
  ok: boolean;
  errors: string[];
  data?: FamilyData;
}

/** Validate a parsed JSON value as importable family data. */
export function validateFamilyData(value: unknown): ImportResult {
  const errors: string[] = [];
  if (typeof value !== 'object' || value === null) {
    return { ok: false, errors: ['The file does not contain a JSON object.'] };
  }
  const data = value as Record<string, unknown>;
  // Accept both the wrapped format and a bare array of people.
  const peopleRaw = Array.isArray(value) ? value : data.people;
  if (!Array.isArray(peopleRaw)) {
    return { ok: false, errors: ['Expected a "people" array in the file.'] };
  }
  if (peopleRaw.length === 0) {
    return { ok: false, errors: ['The file contains no people.'] };
  }
  if (
    !Array.isArray(value) &&
    typeof data.version === 'number' &&
    data.version > FAMILY_DATA_VERSION
  ) {
    return {
      ok: false,
      errors: [
        `This file uses data version ${data.version}, but the app supports up to ${FAMILY_DATA_VERSION}.`,
      ],
    };
  }

  const people: FamilyPerson[] = [];
  peopleRaw.forEach((raw, i) => {
    if (validatePersonShape(raw, i, errors)) people.push(raw);
  });

  const seen = new Set<string>();
  for (const person of people) {
    if (seen.has(person.id)) errors.push(`Duplicate id "${person.id}".`);
    seen.add(person.id);
    if (person.parentIds.includes(person.id)) errors.push(`"${person.id}" is their own parent.`);
    if (person.spouseIds.includes(person.id)) errors.push(`"${person.id}" is their own spouse.`);
    if (person.childIds.includes(person.id)) errors.push(`"${person.id}" is their own child.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    errors: [],
    data: { version: FAMILY_DATA_VERSION, people },
  };
}
