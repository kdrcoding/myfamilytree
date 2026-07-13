import type { FamilyPerson, Gender } from '../types/family';
import { fullName } from './family';

export interface Filters {
  gender: Gender | 'all';
  status: 'all' | 'living' | 'deceased';
  generation: number | 'all';
  country: string | 'all';
}

export const DEFAULT_FILTERS: Filters = {
  gender: 'all',
  status: 'all',
  generation: 'all',
  country: 'all',
};

export function hasActiveFilters(filters: Filters): boolean {
  return (
    filters.gender !== 'all' ||
    filters.status !== 'all' ||
    filters.generation !== 'all' ||
    filters.country !== 'all'
  );
}

export function matchesFilters(
  person: FamilyPerson,
  filters: Filters,
  generations: Map<string, number>,
): boolean {
  if (filters.gender !== 'all' && person.gender !== filters.gender) return false;
  if (filters.status === 'living' && person.isDeceased) return false;
  if (filters.status === 'deceased' && !person.isDeceased) return false;
  if (filters.generation !== 'all' && generations.get(person.id) !== filters.generation)
    return false;
  if (filters.country !== 'all' && person.country?.trim() !== filters.country) return false;
  return true;
}

/** Search across name, nickname, city, country and occupation. */
export function matchesSearch(person: FamilyPerson, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fullName(person), person.nickname, person.city, person.country, person.occupation]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(q));
}
