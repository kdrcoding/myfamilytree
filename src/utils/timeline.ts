import type { FamilyPerson } from '../types/family';
import { marriageDateOf, isDivorced, fullName } from './family';
import { parseDateParts } from './dates';
import type { FamilyMemory } from '../lib/memories';

export type TimelineKind = 'birth' | 'death' | 'marriage' | 'memory';

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  /** Sort key — partial ISO (YYYY / YYYY-MM / YYYY-MM-DD). */
  date: string;
  year: number;
  personIds: string[];
  /** Optional memory payload for photo events. */
  memory?: FamilyMemory;
  /** Partner names for marriages (already resolved). */
  labelNames: string[];
}

/**
 * Build a chronological timeline from people + optional dated memories.
 * Year-only dates sort before more precise ones in the same year.
 */
export function buildTimeline(
  people: FamilyPerson[],
  memories: FamilyMemory[] = [],
): TimelineEvent[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const events: TimelineEvent[] = [];
  const seenMarriages = new Set<string>();

  for (const person of people) {
    if (person.birthDate && parseDateParts(person.birthDate)) {
      events.push({
        id: `birth-${person.id}`,
        kind: 'birth',
        date: person.birthDate,
        year: parseDateParts(person.birthDate)!.year,
        personIds: [person.id],
        labelNames: [fullName(person)],
      });
    }
    if (person.deathDate && parseDateParts(person.deathDate)) {
      events.push({
        id: `death-${person.id}`,
        kind: 'death',
        date: person.deathDate,
        year: parseDateParts(person.deathDate)!.year,
        personIds: [person.id],
        labelNames: [fullName(person)],
      });
    }

    for (const spouseId of person.spouseIds) {
      const pairKey = [person.id, spouseId].sort().join('|');
      if (seenMarriages.has(pairKey)) continue;
      seenMarriages.add(pairKey);
      const spouse = byId.get(spouseId);
      if (!spouse) continue;
      if (isDivorced(person, spouse)) continue;
      const marriedOn = marriageDateOf(person, spouse);
      if (!marriedOn || !parseDateParts(marriedOn)) continue;
      events.push({
        id: `marriage-${pairKey}`,
        kind: 'marriage',
        date: marriedOn,
        year: parseDateParts(marriedOn)!.year,
        personIds: [person.id, spouse.id],
        labelNames: [fullName(person), fullName(spouse)],
      });
    }
  }

  for (const memory of memories) {
    if (!memory.taken_on || !parseDateParts(memory.taken_on)) continue;
    const person = byId.get(memory.person_id);
    events.push({
      id: `memory-${memory.id}`,
      kind: 'memory',
      date: memory.taken_on,
      year: parseDateParts(memory.taken_on)!.year,
      personIds: [memory.person_id],
      labelNames: [person ? fullName(person) : memory.person_id],
      memory,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const order: Record<TimelineKind, number> = {
      birth: 0,
      marriage: 1,
      memory: 2,
      death: 3,
    };
    return order[a.kind] - order[b.kind];
  });

  return events;
}

/** Group timeline events by calendar year (newest first for display). */
export function groupTimelineByYear(events: TimelineEvent[]): { year: number; events: TimelineEvent[] }[] {
  const map = new Map<number, TimelineEvent[]>();
  for (const event of events) {
    const list = map.get(event.year) ?? [];
    list.push(event);
    map.set(event.year, list);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearEvents]) => ({ year, events: yearEvents }));
}
