import { fetchPublicBirthday, fetchMissingBirthdays } from '../features/birthday/publicApi';

const BDAY_KEY = 'familytree.birthdayPass.v1';
const DATES_KEY = 'familytree.datesPass.v1';
const SOFT_KIND_KEY = 'familytree.softUnlockKind.v1';

/** Missing-dates soft unlock lasts at most 2 hours. */
export const DATES_PASS_TTL_MS = 2 * 60 * 60 * 1000;

export type SoftUnlockKind = 'bday' | 'dates';

type Grant = { personId: string };
type DatesGrant = { at: number };

function canUseSession(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Set only after a real birthday page loaded successfully in this tab. */
export function markBirthdayPass(personId: string): void {
  const id = personId.trim();
  if (!id || !canUseSession()) return;
  try {
    sessionStorage.setItem(BDAY_KEY, JSON.stringify({ personId: id } satisfies Grant));
  } catch {
    /* private mode */
  }
}

export function clearBirthdayPass(): void {
  if (!canUseSession()) return;
  try {
    sessionStorage.removeItem(BDAY_KEY);
  } catch {
    /* private mode */
  }
}

export function readBirthdayPass(): Grant | null {
  if (!canUseSession()) return null;
  try {
    const raw = sessionStorage.getItem(BDAY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'personId' in parsed &&
      typeof (parsed as Grant).personId === 'string' &&
      (parsed as Grant).personId.trim().length > 0
    ) {
      return { personId: (parsed as Grant).personId.trim() };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * `?from=bday` is not proof. Access is name-only only while this tab
 * already opened a live birthday page and that page is still open.
 */
export async function birthdayPassStillValid(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<boolean> {
  const grant = readBirthdayPass();
  if (!grant) return false;

  if (import.meta.env.DEV && grant.personId === '_preview') return true;

  try {
    const data = await fetchPublicBirthday(grant.personId);
    if (data.ok) return true;
    if (data.error === 'expired' || data.error === 'not_found') {
      clearBirthdayPass();
      return false;
    }
    return opts?.keepOnNetworkError === true;
  } catch {
    return opts?.keepOnNetworkError === true;
  }
}

/** After opening the public missing-dates page from Telegram (only when work remains). */
export function markDatesPass(): void {
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(DATES_KEY, JSON.stringify({ at: Date.now() } satisfies DatesGrant));
  } catch {
    /* private mode */
  }
}

export function clearDatesPass(): void {
  if (!canUseSession()) return;
  try {
    sessionStorage.removeItem(DATES_KEY);
  } catch {
    /* private mode */
  }
}

function readDatesGrant(): DatesGrant | null {
  if (!canUseSession()) return null;
  try {
    const raw = sessionStorage.getItem(DATES_KEY);
    if (!raw) return null;
    // Legacy: plain "1"
    if (raw === '1') return { at: Date.now() };
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'at' in parsed &&
      typeof (parsed as DatesGrant).at === 'number'
    ) {
      return parsed as DatesGrant;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function readDatesPass(): boolean {
  const grant = readDatesGrant();
  if (!grant) return false;
  if (Date.now() - grant.at > DATES_PASS_TTL_MS) {
    clearDatesPass();
    return false;
  }
  return true;
}

/** Name-only unlock while missing dates remain and the grant is fresh. */
export async function datesPassStillValid(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<boolean> {
  if (!readDatesPass()) return false;
  try {
    const data = await fetchMissingBirthdays();
    if (!data.ok) {
      clearDatesPass();
      return false;
    }
    if ((data.count ?? data.people?.length ?? 0) <= 0) {
      clearDatesPass();
      return false;
    }
    return true;
  } catch {
    return opts?.keepOnNetworkError === true;
  }
}

export function setSoftUnlockKind(kind: SoftUnlockKind | null): void {
  if (!canUseSession()) return;
  try {
    if (!kind) sessionStorage.removeItem(SOFT_KIND_KEY);
    else sessionStorage.setItem(SOFT_KIND_KEY, kind);
  } catch {
    /* private mode */
  }
}

export function readSoftUnlockKind(): SoftUnlockKind | null {
  if (!canUseSession()) return null;
  try {
    const v = sessionStorage.getItem(SOFT_KIND_KEY);
    if (v === 'bday' || v === 'dates') return v;
  } catch {
    /* ignore */
  }
  return null;
}

/** Resolve which soft unlock is currently valid (dates preferred when both). */
export async function resolveSoftUnlockKind(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<SoftUnlockKind | null> {
  if (await datesPassStillValid(opts)) return 'dates';
  if (await birthdayPassStillValid(opts)) return 'bday';
  setSoftUnlockKind(null);
  return null;
}

/** Birthday page or missing-dates page soft unlock. */
export async function softUnlockStillValid(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<boolean> {
  return (await resolveSoftUnlockKind(opts)) != null;
}

export function clearSoftUnlock(): void {
  clearBirthdayPass();
  clearDatesPass();
  setSoftUnlockKind(null);
}

export function hasSoftUnlockGrant(): boolean {
  return Boolean(readBirthdayPass()) || readDatesPass();
}
