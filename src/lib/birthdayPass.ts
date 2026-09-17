import { fetchPublicBirthday, fetchMissingBirthdays } from '../features/birthday/publicApi';

const BDAY_KEY = 'familytree.birthdayPass.v1';
const DATES_KEY = 'familytree.datesPass.v1';

type Grant = { personId: string };

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

/** After opening the public missing-dates page from Telegram. */
export function markDatesPass(): void {
  if (!canUseSession()) return;
  try {
    sessionStorage.setItem(DATES_KEY, '1');
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

export function readDatesPass(): boolean {
  if (!canUseSession()) return false;
  try {
    return sessionStorage.getItem(DATES_KEY) === '1';
  } catch {
    return false;
  }
}

/** Name-only unlock while the public /dates list is reachable. */
export async function datesPassStillValid(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<boolean> {
  if (!readDatesPass()) return false;
  try {
    const data = await fetchMissingBirthdays();
    if (data.ok) return true;
    clearDatesPass();
    return false;
  } catch {
    return opts?.keepOnNetworkError === true;
  }
}

/** Birthday page or missing-dates page soft unlock. */
export async function softUnlockStillValid(opts?: {
  keepOnNetworkError?: boolean;
}): Promise<boolean> {
  if (await birthdayPassStillValid(opts)) return true;
  return datesPassStillValid(opts);
}

export function clearSoftUnlock(): void {
  clearBirthdayPass();
  clearDatesPass();
}

export function hasSoftUnlockGrant(): boolean {
  return Boolean(readBirthdayPass()) || readDatesPass();
}
