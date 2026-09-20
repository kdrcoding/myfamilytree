import { supabase } from './supabase';
import type { FamilyPerson } from '../types/family';
import { hasFullBirthDate } from '../features/birthday/publicApi';
import { isLivingPerson } from '../utils/living';

export type DatesProgress = {
  missing: number;
  filledThisWeek: number;
};

/** Living people still missing a full YYYY-MM-DD birth date. */
export function countMissingBirthDates(people: FamilyPerson[]): number {
  return people.filter((p) => isLivingPerson(p) && !hasFullBirthDate(p.birthDate)).length;
}

/**
 * Server count of birthDate fills logged in the last 7 days.
 * Falls back to zeros when the RPC is missing or unreachable.
 */
export async function fetchFilledThisWeek(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc('birth_date_fill_stats');
  if (error || !data || typeof data !== 'object') return 0;
  const n = (data as { filledThisWeek?: unknown }).filledThisWeek;
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export async function fetchDatesProgress(people: FamilyPerson[]): Promise<DatesProgress> {
  const missing = countMissingBirthDates(people);
  const filledThisWeek = await fetchFilledThisWeek();
  return { missing, filledThisWeek };
}
