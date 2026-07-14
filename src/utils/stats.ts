import type { FamilyPerson } from '../types/family';
import { calculateAge } from './dates';
import { normalizeCountry } from './countries';
import { buildIndex, computeGenerations, fullName, getDescendantIds } from './family';

export interface FamilyStats {
  total: number;
  living: number;
  deceased: number;
  generations: number;
  men: number;
  women: number;
  unspecified: number;
  countries: string[];
  cities: string[];
  oldestLiving: { person: FamilyPerson; age: number } | null;
  youngestLiving: { person: FamilyPerson; age: number } | null;
  averageAge: number | null;
  mostChildren: { person: FamilyPerson; count: number } | null;
  mostDescendants: { person: FamilyPerson; count: number } | null;
  perGeneration: { generation: number; count: number }[];
  perCountry: { country: string; count: number }[];
  /** Couples (unique spouse pairs), and average children per parent. */
  couples: number;
  averageChildren: number | null;
  largestGeneration: number | null;
}

export function computeStats(people: FamilyPerson[]): FamilyStats {
  const index = buildIndex(people);
  const generations = computeGenerations(people);
  const living = people.filter((p) => !p.isDeceased);

  // Merge country variants (uzbekistan / Uzbekiston / Узбекистан → one).
  const countries = [
    ...new Set(people.map((p) => normalizeCountry(p.country)).filter(Boolean)),
  ] as string[];
  const cities = [...new Set(people.map((p) => p.city?.trim()).filter(Boolean))] as string[];

  let oldestLiving: FamilyStats['oldestLiving'] = null;
  let youngestLiving: FamilyStats['youngestLiving'] = null;
  const livingAges: number[] = [];
  for (const person of living) {
    const age = calculateAge(person.birthDate);
    if (age === null) continue;
    livingAges.push(age);
    if (!oldestLiving || age > oldestLiving.age) oldestLiving = { person, age };
    if (!youngestLiving || age < youngestLiving.age) youngestLiving = { person, age };
  }

  let mostChildren: FamilyStats['mostChildren'] = null;
  let mostDescendants: FamilyStats['mostDescendants'] = null;
  for (const person of people) {
    if (!mostChildren || person.childIds.length > mostChildren.count) {
      mostChildren = { person, count: person.childIds.length };
    }
    const descendants = getDescendantIds(person.id, index).size;
    if (!mostDescendants || descendants > mostDescendants.count) {
      mostDescendants = { person, count: descendants };
    }
  }
  if (mostChildren && mostChildren.count === 0) mostChildren = null;
  if (mostDescendants && mostDescendants.count === 0) mostDescendants = null;

  const genCounts = new Map<number, number>();
  for (const gen of generations.values()) genCounts.set(gen, (genCounts.get(gen) ?? 0) + 1);

  const countryCounts = new Map<string, number>();
  for (const person of people) {
    const country = normalizeCountry(person.country);
    if (country) countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }

  // Unique couples (dedupe each spouse pair) and children-per-parent average.
  const couplePairs = new Set<string>();
  const parentChildCounts: number[] = [];
  for (const person of people) {
    for (const spouseId of person.spouseIds) {
      couplePairs.add([person.id, spouseId].sort().join('|'));
    }
    if (person.childIds.length > 0) parentChildCounts.push(person.childIds.length);
  }
  const averageChildren =
    parentChildCounts.length > 0
      ? Math.round(
          (parentChildCounts.reduce((a, b) => a + b, 0) / parentChildCounts.length) * 10,
        ) / 10
      : null;

  const genEntries = [...genCounts.entries()].sort((a, b) => a[0] - b[0]);
  const largestGeneration =
    genEntries.length > 0
      ? genEntries.reduce((max, e) => (e[1] > max[1] ? e : max))[0]
      : null;

  return {
    total: people.length,
    living: living.length,
    deceased: people.length - living.length,
    generations: people.length > 0 ? Math.max(...generations.values()) : 0,
    men: people.filter((p) => p.gender === 'male').length,
    women: people.filter((p) => p.gender === 'female').length,
    unspecified: people.filter((p) => p.gender === 'unspecified').length,
    countries,
    cities,
    oldestLiving,
    youngestLiving,
    averageAge:
      livingAges.length >= 3
        ? Math.round(livingAges.reduce((a, b) => a + b, 0) / livingAges.length)
        : null,
    mostChildren,
    mostDescendants,
    perGeneration: genEntries.map(([generation, count]) => ({ generation, count })),
    perCountry: [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count })),
    couples: couplePairs.size,
    averageChildren,
    largestGeneration,
  };
}

export { fullName };
