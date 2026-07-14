// LocalStorage is only used for per-browser UI preferences and the remembered
// password. The family data itself lives in Supabase (src/lib/familyDb.ts).
export const STORAGE_KEYS = {
  settings: 'familytree.settings.v1',
  collapsed: 'familytree.collapsed.v1',
  auth: 'familytree.auth.v1',
  // The person add/edit form autosaves here so an accidental reload (or a
  // phone browser discarding the backgrounded tab) doesn't lose typed work.
  formDraft: 'familytree.formDraft.v1',
} as const;

/**
 * Read and parse a LocalStorage entry. Returns `null` when the entry is
 * missing, unparsable or rejected by the optional validator, so callers can
 * always fall back to defaults safely.
 */
export function loadJson<T>(key: string, validate?: (value: unknown) => value is T): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage may be full or blocked; the app keeps working in memory.
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore - nothing to clean up if storage is unavailable.
  }
}
