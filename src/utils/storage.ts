// LocalStorage is only used for per-browser UI preferences and the remembered
// password. The family data itself lives in Supabase (src/lib/familyDb.ts).
export const STORAGE_KEYS = {
  settings: 'familytree.settings.v1',
  // v3 leftover from a fold/expand experiment. The tree now always shows
  // every generation; this key is unused.
  collapsed: 'familytree.collapsed.v3',
  auth: 'familytree.auth.v1',
  // The person add/edit form autosaves here so an accidental reload (or a
  // phone browser discarding the backgrounded tab) doesn't lose typed work.
  formDraft: 'familytree.formDraft.v1',
  // Last date (YYYY-MM-DD) we showed the "birthday today" popup, so it fires
  // at most once per day per browser after login / home visit.
  birthdayNotified: 'familytree.birthdayNotified.v1',
  // The person's own name at sign-in (family editors). Owner always uses "Kadir".
  displayName: 'familytree.displayName.v1',
  // This device entered a name (used to prefill the gate).
  namedDevice: 'familytree.namedDevice.v1',
  // SHA-256 of the family password — remembered until Sign out.
  familyAuthed: 'familytree.familyAuthed.v1',
  // Legacy flag from an older auto-login experiment (safe to ignore / clear).
  skipOwnerAuto: 'familytree.skipOwnerAuto.v1',
  // Signed URLs for Storage-hosted photos, reused until near expiry so the
  // browser cache keeps working across visits.
  photoUrls: 'familytree.photoUrls.v1',
  // Last successful family snapshot. Returning visits paint instantly, then
  // refresh from Supabase in the background.
  familyCache: 'familytree.familyCache.v1',
  // Tree view preferences.
  treeOrientation: 'familytree.treeOrientation.v1',
  // Classic-tree gap density: 'tight' (default, slightly compact) or 'airy' (original).
  treeSpacing: 'familytree.treeSpacing.v1',
  // Dismissed the one-time "how to use the tree" tip.
  treeTipSeen: 'familytree.treeTipSeen.v1',
  // Dismissed the one-time “tap the wedding rings” tip on the tree.
  treeRingsTipSeen: 'familytree.treeRingsTipSeen.v1',
  // First-visit welcome tour completed.
  tourSeen: 'familytree.tourSeen.v1',
  // Dismissed invite banner for this browser session key.
  inviteBannerDismissed: 'familytree.inviteBanner.v1',
  // One-time “Add to Home Screen” tip dismissed.
  installTipDismissed: 'familytree.installTip.v1',
  // Last time the owner downloaded a JSON backup (monthly nudge).
  backupDownloadedAt: 'familytree.backupDownloadedAt.v1',
  // Custom family reunions / tradition dates (mirrored from app_settings when online).
  traditions: 'familytree.traditions.v1',
  // Last tradition-day popup key (id:YYYY-MM-DD) so it fires once per holiday.
  traditionNotified: 'familytree.traditionNotified.v1',
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

/** Fired (debounced) when LocalStorage rejects a write. */
export const STORAGE_FAIL_EVENT = 'familytree:storage-failed';

let storageFailTimer: number | undefined;

function notifyStorageFailed() {
  if (typeof window === 'undefined') return;
  if (storageFailTimer !== undefined) window.clearTimeout(storageFailTimer);
  storageFailTimer = window.setTimeout(() => {
    storageFailTimer = undefined;
    window.dispatchEvent(new Event(STORAGE_FAIL_EVENT));
  }, 500);
}

export function saveJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (typeof window !== 'undefined' && storageFailTimer !== undefined) {
      window.clearTimeout(storageFailTimer);
      storageFailTimer = undefined;
    }
    return true;
  } catch {
    // Storage may be full or blocked; the app keeps working in memory.
    notifyStorageFailed();
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
