import { supabase } from './supabase';
import { deletePhoto, isStoragePhoto, uploadPhoto } from './photoStorage';

export interface FamilyMemory {
  id: string;
  person_id: string;
  title?: string | null;
  caption?: string | null;
  /** Fuzzy date: YYYY, YYYY-MM or YYYY-MM-DD. */
  taken_on?: string | null;
  /** Storage path (or legacy data-URL). */
  photo: string;
  sort_order: number;
  created_at: string;
}

/** Memories for one person, oldest first (album order). */
export async function listMemories(personId: string): Promise<FamilyMemory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_memories')
    .select('*')
    .eq('person_id', personId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyMemory[];
}

/** All memories that have a date — used by the Timeline page. */
export async function listDatedMemories(): Promise<FamilyMemory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_memories')
    .select('*')
    .not('taken_on', 'is', null)
    .order('taken_on', { ascending: true });
  if (error) throw error;
  return (data ?? []) as FamilyMemory[];
}

/**
 * Upload a photo and insert a memory row. `dataUrl` should already be
 * downscaled (same as profile photos).
 */
export async function addMemory(input: {
  personId: string;
  dataUrl: string;
  title?: string;
  caption?: string;
  takenOn?: string;
}): Promise<FamilyMemory> {
  if (!supabase) throw new Error('Supabase is not configured');

  const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  // Reuse the people/ path so existing Storage policies cover memory photos.
  const photo = await uploadPhoto(input.personId, input.dataUrl);

  const row = {
    id,
    person_id: input.personId,
    title: input.title?.trim() || null,
    caption: input.caption?.trim() || null,
    taken_on: input.takenOn?.trim() || null,
    photo,
    sort_order: Date.now(),
  };

  const { data, error } = await supabase.from('family_memories').insert(row).select('*').single();
  if (error) {
    deletePhoto(photo);
    throw error;
  }
  return data as FamilyMemory;
}

/** Owner-only delete (enforced by RLS too). */
export async function deleteMemory(memory: FamilyMemory): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('family_memories').delete().eq('id', memory.id);
  if (error) throw error;
  if (isStoragePhoto(memory.photo)) deletePhoto(memory.photo);
}
