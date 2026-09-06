import { fetchPublicBirthday } from '../features/birthday/publicApi';

const KEY = 'familytree.birthdayPass.v1';

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
    sessionStorage.setItem(KEY, JSON.stringify({ personId: id } satisfies Grant));
  } catch {
    /* private mode */
  }
}

export function clearBirthdayPass(): void {
  if (!canUseSession()) return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export function readBirthdayPass(): Grant | null {
  if (!canUseSession()) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
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
