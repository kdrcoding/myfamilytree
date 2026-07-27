import { supabase } from './supabase';
import { deletePhoto, isStoragePhoto, uploadAudio } from './photoStorage';

export interface AudioStory {
  id: string;
  person_id: string;
  title?: string | null;
  caption?: string | null;
  audio: string;
  duration_sec?: number | null;
  created_at: string;
}

export async function listAudioStories(personId: string): Promise<AudioStory[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('family_audio_stories')
    .select('*')
    .eq('person_id', personId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as AudioStory[];
}

export async function addAudioStory(input: {
  personId: string;
  blob: Blob;
  title?: string;
  caption?: string;
  durationSec?: number;
  ext?: string;
}): Promise<AudioStory> {
  if (!supabase) throw new Error('Supabase is not configured');

  const id = `aud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const audio = await uploadAudio(input.personId, input.blob, input.ext ?? 'webm');

  const row = {
    id,
    person_id: input.personId,
    title: input.title?.trim() || null,
    caption: input.caption?.trim() || null,
    audio,
    duration_sec: input.durationSec ?? null,
  };

  const { data, error } = await supabase
    .from('family_audio_stories')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    deletePhoto(audio);
    throw error;
  }
  return data as AudioStory;
}

export async function deleteAudioStory(story: AudioStory): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from('family_audio_stories').delete().eq('id', story.id);
  if (error) throw error;
  if (isStoragePhoto(story.audio)) deletePhoto(story.audio);
}
