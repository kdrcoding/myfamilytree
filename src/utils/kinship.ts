import type { FamilyPerson, Gender } from '../types/family';
import { fullName } from './family';

/** Structured kinship between two people — the UI turns this into plain words. */
export type Kinship =
  | { kind: 'self' }
  | { kind: 'spouse' }
  | { kind: 'parent' } // a is parent of b
  | { kind: 'child' } // a is child of b
  | { kind: 'grandparent'; generations: number } // 2 = grand, 3 = great-grand…
  | { kind: 'grandchild'; generations: number }
  | { kind: 'sibling' }
  | { kind: 'uncle' } // a is uncle/aunt of b
  | { kind: 'nephew' } // a is nephew/niece of b
  | { kind: 'cousin'; degree: number; removal: number }
  | { kind: 'inlaw'; role: 'spouse-of-relative' | 'relative-of-spouse'; viaName: string }
  | { kind: 'unrelated' };

function ancestorsOf(
  startId: string,
  byId: Map<string, FamilyPerson>,
): Map<string, number> {
  const depths = new Map<string, number>();
  const queue: { id: string; depth: number }[] = [{ id: startId, depth: 0 }];
  depths.set(startId, 0);
  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const person = byId.get(id);
    if (!person) continue;
    for (const parentId of person.parentIds) {
      if (depths.has(parentId)) continue;
      depths.set(parentId, depth + 1);
      queue.push({ id: parentId, depth: depth + 1 });
    }
  }
  return depths;
}

/** Blood + spouse only (no in-law recursion). */
function bloodOrSpouse(
  aId: string,
  bId: string,
  byId: Map<string, FamilyPerson>,
): Kinship {
  if (aId === bId) return { kind: 'self' };
  const a = byId.get(aId);
  const b = byId.get(bId);
  if (!a || !b) return { kind: 'unrelated' };

  if (a.spouseIds.includes(bId) || b.spouseIds.includes(aId)) {
    return { kind: 'spouse' };
  }

  const ancA = ancestorsOf(aId, byId);
  const ancB = ancestorsOf(bId, byId);

  if (ancB.has(aId)) {
    const gens = ancB.get(aId)!;
    if (gens === 1) return { kind: 'parent' };
    return { kind: 'grandparent', generations: gens };
  }
  if (ancA.has(bId)) {
    const gens = ancA.get(bId)!;
    if (gens === 1) return { kind: 'child' };
    return { kind: 'grandchild', generations: gens };
  }

  let best: { da: number; db: number } | null = null;
  for (const [id, da] of ancA) {
    if (id === aId || id === bId || da === 0) continue;
    const db = ancB.get(id);
    if (db === undefined || db === 0) continue;
    if (!best || da + db < best.da + best.db) best = { da, db };
  }

  if (best) {
    const { da, db } = best;
    if (da === 1 && db === 1) return { kind: 'sibling' };
    if (da === 1 && db >= 2) return { kind: 'uncle' };
    if (db === 1 && da >= 2) return { kind: 'nephew' };
    const degree = Math.min(da, db) - 1;
    const removal = Math.abs(da - db);
    return { kind: 'cousin', degree: Math.max(1, degree), removal };
  }

  return { kind: 'unrelated' };
}

/**
 * How person A relates to person B.
 * Prefers blood (shared ancestors), then spouse, then simple in-law.
 */
export function describeKinship(
  aId: string,
  bId: string,
  people: FamilyPerson[],
): Kinship {
  const byId = new Map(people.map((p) => [p.id, p]));
  const direct = bloodOrSpouse(aId, bId, byId);
  if (direct.kind !== 'unrelated') return direct;

  const a = byId.get(aId);
  const b = byId.get(bId);
  if (!a || !b) return { kind: 'unrelated' };

  for (const spouseId of a.spouseIds) {
    const k = bloodOrSpouse(spouseId, bId, byId);
    if (k.kind !== 'unrelated' && k.kind !== 'self') {
      const spouse = byId.get(spouseId);
      return {
        kind: 'inlaw',
        role: 'relative-of-spouse',
        viaName: spouse ? fullName(spouse) : '',
      };
    }
  }
  for (const spouseId of b.spouseIds) {
    const k = bloodOrSpouse(aId, spouseId, byId);
    if (k.kind !== 'unrelated' && k.kind !== 'self') {
      const spouse = byId.get(spouseId);
      return {
        kind: 'inlaw',
        role: 'spouse-of-relative',
        viaName: spouse ? fullName(spouse) : '',
      };
    }
  }

  return { kind: 'unrelated' };
}

/** Pick he/she-aware word forms from gender. */
export function gendered(
  gender: Gender,
  male: string,
  female: string,
  neutral: string,
): string {
  if (gender === 'male') return male;
  if (gender === 'female') return female;
  return neutral;
}
