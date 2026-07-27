import { supabase } from './supabase';
import type { FamilyPerson, RelationLink } from '../types/family';
import { JOIN_REQUEST_TYPE } from '../types/family';
import { loadJson, STORAGE_KEYS } from '../utils/storage';
import { AUTH_EMAILS } from '../config/access';

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

/** One pending (or reviewed) "Add yourself" submission in the database. */
export interface StoredJoinRequest {
  id: string;
  status: JoinRequestStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  submitter_name?: string | null;
  person: FamilyPerson;
  link: RelationLink | null;
  link_target_name?: string | null;
  note?: string | null;
}

function displayName(): string | null {
  return (
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ||
    null
  );
}

/**
 * Submit a join request instead of adding the person immediately.
 * The owner reviews it in Settings and approves into the live tree.
 */
export async function submitJoinRequest(input: {
  person: FamilyPerson;
  link?: RelationLink | null;
  linkTargetName?: string;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');

  const requestId = `join-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const row = {
    id: requestId,
    status: 'pending' as const,
    submitter_name: displayName(),
    person: {
      ...input.person,
      // Never trust relationship arrays from a self-join payload.
      parentIds: [],
      spouseIds: [],
      childIds: [],
      divorcedIds: undefined,
    },
    link: input.link ?? null,
    link_target_name: input.linkTargetName ?? null,
    note: 'Submitted from Add yourself — waiting for owner approval.',
  };

  const { error } = await supabase.from('family_join_requests').insert(row);
  if (error) throw error;
}

/** Newest pending requests first (owner inbox). */
export async function listPendingJoinRequests(): Promise<StoredJoinRequest[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_join_requests')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeRow);
}

/** Count of open requests — for a badge on Settings. */
export async function countPendingJoinRequests(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('family_join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/** Mark a request approved after the person was added to the tree. */
export async function markJoinRequestApproved(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('family_join_requests')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: AUTH_EMAILS.owner,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Reject without adding anyone. */
export async function rejectJoinRequest(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('family_join_requests')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: AUTH_EMAILS.owner,
    })
    .eq('id', id);
  if (error) throw error;
}

function normalizeRow(row: Record<string, unknown>): StoredJoinRequest {
  const person = row.person as FamilyPerson;
  return {
    id: String(row.id),
    status: (row.status as JoinRequestStatus) ?? 'pending',
    submitted_at: String(row.submitted_at ?? ''),
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    submitter_name: (row.submitter_name as string | null) ?? null,
    person: {
      ...person,
      parentIds: [],
      spouseIds: [],
      childIds: [],
    },
    link: (row.link as RelationLink | null) ?? null,
    link_target_name: (row.link_target_name as string | null) ?? null,
    note: (row.note as string | null) ?? null,
  };
}

/** Helper so callers can still recognise the old JSON join-request shape. */
export function isLegacyJoinRequestFile(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: string }).type === JOIN_REQUEST_TYPE
  );
}
