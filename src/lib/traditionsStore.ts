import { supabase } from './supabase';
import { loadJson, saveJson, STORAGE_KEYS } from '../utils/storage';
import {
  isCustomTraditionList,
  type CustomTradition,
} from '../utils/traditions';

const SETTINGS_KEY = 'family_traditions';

function readLocal(): CustomTradition[] {
  return (
    loadJson<CustomTradition[]>(STORAGE_KEYS.traditions, isCustomTraditionList) ?? []
  );
}

function writeLocal(list: CustomTradition[]): void {
  saveJson(STORAGE_KEYS.traditions, list.slice(0, 40));
}

/** Load custom reunions — shared DB when available, else this device. */
export async function fetchCustomTraditions(): Promise<CustomTradition[]> {
  if (!supabase) return readLocal();
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();
    if (error) throw error;
    const value = (data as { value?: unknown } | null)?.value;
    if (isCustomTraditionList(value)) {
      writeLocal(value);
      return value;
    }
  } catch (err) {
    console.warn('traditions fetch failed', err);
  }
  return readLocal();
}

/** Owner: save custom reunions for the whole family. */
export async function saveCustomTraditions(list: CustomTradition[]): Promise<void> {
  const cleaned = list
    .map((row) => ({
      id: row.id.trim().slice(0, 40) || crypto.randomUUID(),
      title: row.title.trim().slice(0, 80),
      date: row.date.trim(),
    }))
    .filter((row) => row.title && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .slice(0, 40);

  writeLocal(cleaned);

  if (!supabase) return;
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: SETTINGS_KEY, value: cleaned });
  if (error) throw error;
}
