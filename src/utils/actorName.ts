import { OWNER_DEFAULT_NAME, type Role } from '../config/access';
import { loadJson, saveJson, STORAGE_KEYS } from './storage';

/** Legacy cheer-only name key (kept in sync for older tabs). */
export const CHEER_NAME_KEY = 'oqariq-bday-cheer-name';

function readRaw(key: string): string {
  try {
    const v = localStorage.getItem(key);
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

function writeRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / full */
  }
}

/**
 * Name already known for this browser: owner → Kadir, else saved family name,
 * else a previous birthday cheer name.
 */
export function resolveActorName(role?: Role | null): string {
  if (role === 'owner') return OWNER_DEFAULT_NAME;

  const fromSettings =
    loadJson<string>(STORAGE_KEYS.displayName, (v): v is string => typeof v === 'string')?.trim() ??
    '';
  if (fromSettings.length >= 2) return fromSettings.slice(0, 40);

  // Legacy unquoted / JSON string forms
  const rawDisplay = readRaw(STORAGE_KEYS.displayName).replace(/^"|"$/g, '').trim();
  if (rawDisplay.length >= 2) return rawDisplay.slice(0, 40);

  const cheer = readRaw(CHEER_NAME_KEY).trim();
  if (cheer.length >= 2) return cheer.slice(0, 40);

  return '';
}

/** Persist the actor name everywhere birthday + gate look for it. */
export function rememberActorName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, 40);
  if (trimmed.length < 2) return '';
  saveJson(STORAGE_KEYS.displayName, trimmed);
  writeRaw(CHEER_NAME_KEY, trimmed);
  return trimmed;
}
