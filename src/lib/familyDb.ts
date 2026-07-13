import type { FamilyPerson, Gender } from '../types/family';
import { supabase } from './supabase';

/** Row shapes matching supabase/migrations/20260713000001_init.sql. */
export interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  gender: Gender;
  birth_date: string | null;
  death_date: string | null;
  is_deceased: boolean;
  photo: string | null;
  city: string | null;
  country: string | null;
  occupation: string | null;
  biography: string | null;
}

export interface RelationshipRow {
  key: string;
  kind: 'spouse' | 'parent-child';
  person_a: string;
  person_b: string;
}

const GENDERS: Gender[] = ['male', 'female', 'unspecified'];

export function toMemberRow(person: FamilyPerson): MemberRow {
  return {
    id: person.id,
    first_name: person.firstName,
    last_name: person.lastName,
    nickname: person.nickname ?? null,
    gender: person.gender,
    birth_date: person.birthDate ?? null,
    death_date: person.deathDate ?? null,
    is_deceased: person.isDeceased,
    photo: person.photo ?? null,
    city: person.city ?? null,
    country: person.country ?? null,
    occupation: person.occupation ?? null,
    biography: person.biography ?? null,
  };
}

/** Deterministic relationship keys, so syncing is idempotent. */
export function spouseKey(aId: string, bId: string): string {
  const [a, b] = [aId, bId].sort();
  return `spouse|${a}|${b}`;
}

export function parentKey(parentId: string, childId: string): string {
  return `parent|${parentId}|${childId}`;
}

/** The canonical relationship rows implied by a people array. */
export function relationshipRowsFor(people: FamilyPerson[]): Map<string, RelationshipRow> {
  const rows = new Map<string, RelationshipRow>();
  for (const person of people) {
    for (const spouseId of person.spouseIds) {
      const [a, b] = [person.id, spouseId].sort();
      rows.set(spouseKey(a, b), { key: spouseKey(a, b), kind: 'spouse', person_a: a, person_b: b });
    }
    for (const childId of person.childIds) {
      const key = parentKey(person.id, childId);
      rows.set(key, { key, kind: 'parent-child', person_a: person.id, person_b: childId });
    }
  }
  return rows;
}

/** Rebuild the app's people array from database rows. */
export function peopleFromRows(members: MemberRow[], rels: RelationshipRow[]): FamilyPerson[] {
  const people = new Map<string, FamilyPerson>();
  for (const row of members) {
    people.set(row.id, {
      id: row.id,
      firstName: row.first_name ?? '',
      lastName: row.last_name ?? '',
      nickname: row.nickname ?? undefined,
      gender: GENDERS.includes(row.gender) ? row.gender : 'unspecified',
      birthDate: row.birth_date ?? undefined,
      deathDate: row.death_date ?? undefined,
      isDeceased: Boolean(row.is_deceased),
      photo: row.photo ?? undefined,
      city: row.city ?? undefined,
      country: row.country ?? undefined,
      occupation: row.occupation ?? undefined,
      biography: row.biography ?? undefined,
      parentIds: [],
      spouseIds: [],
      childIds: [],
    });
  }
  const sorted = [...rels].sort((a, b) => a.key.localeCompare(b.key));
  for (const rel of sorted) {
    const a = people.get(rel.person_a);
    const b = people.get(rel.person_b);
    if (!a || !b) continue; // orphan row: ignore rather than crash
    if (rel.kind === 'spouse') {
      if (!a.spouseIds.includes(b.id)) a.spouseIds.push(b.id);
      if (!b.spouseIds.includes(a.id)) b.spouseIds.push(a.id);
    } else {
      if (!a.childIds.includes(b.id)) a.childIds.push(b.id);
      if (!b.parentIds.includes(a.id)) b.parentIds.push(a.id);
    }
  }
  return [...people.values()];
}

export async function fetchFamily(): Promise<FamilyPerson[]> {
  if (!supabase) throw new Error('Supabase is not configured');
  const [members, rels] = await Promise.all([
    supabase.from('family_members').select('*'),
    supabase.from('family_relationships').select('*'),
  ]);
  if (members.error) throw members.error;
  if (rels.error) throw rels.error;
  return peopleFromRows(
    (members.data ?? []) as MemberRow[],
    (rels.data ?? []) as RelationshipRow[],
  );
}

export interface FamilyDiff {
  upsertMembers: MemberRow[];
  deleteMemberIds: string[];
  insertRelationships: RelationshipRow[];
  deleteRelationshipKeys: string[];
}

export function isEmptyDiff(diff: FamilyDiff): boolean {
  return (
    diff.upsertMembers.length === 0 &&
    diff.deleteMemberIds.length === 0 &&
    diff.insertRelationships.length === 0 &&
    diff.deleteRelationshipKeys.length === 0
  );
}

/** Minimal set of database writes that turns `prev` into `next`. */
export function diffFamily(prev: FamilyPerson[], next: FamilyPerson[]): FamilyDiff {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const nextIds = new Set(next.map((p) => p.id));

  const upsertMembers: MemberRow[] = [];
  for (const person of next) {
    const row = toMemberRow(person);
    const before = prevById.get(person.id);
    if (!before || JSON.stringify(toMemberRow(before)) !== JSON.stringify(row)) {
      upsertMembers.push(row);
    }
  }
  const deleteMemberIds = prev.filter((p) => !nextIds.has(p.id)).map((p) => p.id);

  const prevRels = relationshipRowsFor(prev);
  const nextRels = relationshipRowsFor(next);
  const insertRelationships = [...nextRels.values()].filter((r) => !prevRels.has(r.key));
  const deleteRelationshipKeys = [...prevRels.keys()].filter((key) => {
    if (nextRels.has(key)) return false;
    // Relationships of deleted people are removed by ON DELETE CASCADE.
    const rel = prevRels.get(key)!;
    return nextIds.has(rel.person_a) && nextIds.has(rel.person_b);
  });

  return { upsertMembers, deleteMemberIds, insertRelationships, deleteRelationshipKeys };
}

/**
 * Apply a diff to Supabase. Order matters: people must exist before their
 * relationships reference them, and stale relationships go before new ones.
 */
export async function pushDiff(diff: FamilyDiff): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  if (diff.upsertMembers.length > 0) {
    const { error } = await supabase.from('family_members').upsert(diff.upsertMembers);
    if (error) throw error;
  }
  if (diff.deleteRelationshipKeys.length > 0) {
    const { error } = await supabase
      .from('family_relationships')
      .delete()
      .in('key', diff.deleteRelationshipKeys);
    if (error) throw error;
  }
  if (diff.insertRelationships.length > 0) {
    const { error } = await supabase
      .from('family_relationships')
      .upsert(diff.insertRelationships);
    if (error) throw error;
  }
  if (diff.deleteMemberIds.length > 0) {
    const { error } = await supabase.from('family_members').delete().in('id', diff.deleteMemberIds);
    if (error) throw error;
  }
}

/** Record when/how the database was seeded (explicit setup action). */
export async function markSeeded(source: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'seededAt', value: { at: new Date().toISOString(), source } });
  if (error) console.error('Failed to record seed marker in Supabase:', error);
}
