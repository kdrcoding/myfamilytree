import { supabase } from './supabase';
import type { FamilyPerson } from '../types/family';
import { fullName } from '../utils/family';

/** What kind of operation produced a change (set by the calling action). */
export type AuditAction = 'add' | 'edit' | 'delete' | 'divorce' | 'import' | 'reset';

export interface AuditDetails {
  added?: string[];
  deleted?: string[];
  updated?: { name: string; fields: string[] }[];
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: AuditAction | string;
  details: AuditDetails;
}

const PERSON_FIELDS = [
  'firstName',
  'lastName',
  'nickname',
  'gender',
  'birthDate',
  'deathDate',
  'isDeceased',
  'photo',
  'city',
  'country',
  'occupation',
  'biography',
] as const;

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

function capped(names: string[]): string[] {
  return names.length > 20 ? [...names.slice(0, 20), `… +${names.length - 20}`] : names;
}

/**
 * Human-readable summary of what changed between two versions of the family:
 * who was added/deleted, and which fields or relationships changed on whom.
 * Returns null when nothing actually changed.
 */
export function summarizeFamilyChange(
  prev: FamilyPerson[],
  next: FamilyPerson[],
): AuditDetails | null {
  const prevById = new Map(prev.map((p) => [p.id, p]));
  const nextIds = new Set(next.map((p) => p.id));

  const added = next.filter((p) => !prevById.has(p.id)).map(fullName);
  const deleted = prev.filter((p) => !nextIds.has(p.id)).map(fullName);

  const updated: { name: string; fields: string[] }[] = [];
  for (const person of next) {
    const before = prevById.get(person.id);
    if (!before) continue;
    const fields: string[] = [];
    for (const key of PERSON_FIELDS) {
      if ((before[key] ?? '') !== (person[key] ?? '')) fields.push(key);
    }
    if (!sameIds(before.parentIds, person.parentIds)) fields.push('parents');
    if (!sameIds(before.spouseIds, person.spouseIds)) fields.push('spouses');
    if (!sameIds(before.childIds, person.childIds)) fields.push('children');
    if (!sameIds(before.divorcedIds ?? [], person.divorcedIds ?? [])) fields.push('divorced');
    if (fields.length > 0) updated.push({ name: fullName(person), fields });
  }

  if (added.length === 0 && deleted.length === 0 && updated.length === 0) return null;
  return {
    added: added.length ? capped(added) : undefined,
    deleted: deleted.length ? capped(deleted) : undefined,
    updated: updated.length ? updated.slice(0, 20) : undefined,
  };
}

/**
 * Record a change in the owner-only log. Fire-and-forget: the database
 * function stamps who did it from the signed-in account, so the entry
 * can't be forged.
 */
export function logChange(action: AuditAction, details: AuditDetails): void {
  if (!supabase) return;
  void supabase
    .rpc('log_family_change', { p_action: action, p_details: details })
    .then(({ error }) => {
      if (error) console.error('Failed to record change in the log:', error);
    });
}

/** Owner-only: newest entries first. */
export async function listAuditLog(limit = 50): Promise<AuditEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_audit_log')
    .select('id, at, actor, action, details')
    .order('at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}
