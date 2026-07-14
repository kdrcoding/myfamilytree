import { supabase } from './supabase';
import { peopleFromRows } from './familyDb';
import type { MemberRow, RelationshipRow } from './familyDb';
import { FAMILY_DATA_VERSION } from '../types/family';

export interface BackupMeta {
  id: number;
  taken_at: string;
  member_count: number;
  relationship_count: number;
}

/**
 * Fire-and-forget daily backup: the database function snapshots everything
 * at most once per ~day, so calling this on every app load is free. Any
 * signed-in family member's visit keeps the backups fresh.
 */
export function autoBackup(): void {
  if (!supabase) return;
  void supabase.rpc('take_family_backup').then(({ error }) => {
    if (error) console.error('Automatic backup failed:', error);
  });
}

/** Owner action: take a snapshot right now regardless of the last one. */
export async function forceBackup(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('take_family_backup', { min_hours: 0 });
  if (error) throw error;
  return Boolean(data);
}

export async function listBackups(limit = 10): Promise<BackupMeta[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_backups')
    .select('id, taken_at, member_count, relationship_count')
    .order('taken_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as BackupMeta[];
}

/**
 * Download one snapshot converted to the app's normal export format, so it
 * can be restored with the existing Settings -> Import action.
 */
export async function downloadBackup(id: number): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('family_backups')
    .select('taken_at, data')
    .eq('id', id)
    .single();
  if (error) throw error;
  const row = data as {
    taken_at: string;
    data: { members: MemberRow[]; relationships: RelationshipRow[] };
  };
  const people = peopleFromRows(row.data.members ?? [], row.data.relationships ?? []);
  const json = JSON.stringify(
    { version: FAMILY_DATA_VERSION, exportedAt: row.taken_at, people },
    null,
    2,
  );
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `family-backup-${row.taken_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
