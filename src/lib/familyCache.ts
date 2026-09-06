import type { FamilyPerson } from '../types/family';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import { fetchFamily } from './familyDb';
import { isSupabaseConfigured } from './supabase';

export function isFamilyPeople(value: unknown): value is FamilyPerson[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every((row) => {
    if (typeof row !== 'object' || row === null) return false;
    const person = row as FamilyPerson;
    return (
      typeof person.id === 'string' &&
      typeof person.firstName === 'string' &&
      Array.isArray(person.parentIds) &&
      Array.isArray(person.spouseIds) &&
      Array.isArray(person.childIds)
    );
  });
}

export function readFamilyCache(): FamilyPerson[] | null {
  return loadJson<FamilyPerson[]>(STORAGE_KEYS.familyCache, isFamilyPeople);
}

export function writeFamilyCache(people: FamilyPerson[]): void {
  if (people.length === 0) return;
  saveJson(STORAGE_KEYS.familyCache, people);
}

// Start the first Supabase fetch as soon as this module loads — before React
// paints the lock screen — so the data is often ready when the user enters.
let inflight: Promise<FamilyPerson[]> | null = isSupabaseConfigured ? fetchFamily() : null;

/** First caller reuses the boot-time request. Later calls fetch fresh. */
export function loadFamily(): Promise<FamilyPerson[]> {
  if (inflight) {
    const pending = inflight;
    inflight = null;
    return pending;
  }
  return fetchFamily();
}
