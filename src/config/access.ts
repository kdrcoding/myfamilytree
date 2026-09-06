/**
 * Access control for the family site.
 *
 * The main site asks for a name and the family password. A live Telegram
 * birthday page (`/bday/:id`) can skip the password (name only) while that
 * page is still open. After it expires, the family password is required.
 *
 * Never put plaintext passwords in this file or in VITE_ env. Generate a
 * new hash on the Settings page ("Access" section) if a password changes.
 */
export const ACCESS = {
  /** SHA-256 hash of the owner password. */
  ownerHash: '39f2df21ef6aecdc8a706868252ef11e46afda2beecdcfc471109870faf1ff8e',
  /** SHA-256 hash of the shared family password. */
  editorHash: '7fcc57f15a0a35995b1ef5fe78808863346e806aa2b86128c48c0133749c7586',
} as const;

/** Display name used for the owner account (no name prompt after unlock). */
export const OWNER_DEFAULT_NAME = 'Kadir';

/**
 * Supabase Auth accounts. Owner JWT is required for deletes, relationship
 * writes, and telegram settings. Family editors use the anon key;
 * RLS allows anon the same family read/write they already had.
 * Never put the owner password in VITE_ env or the client bundle.
 */
export const AUTH_EMAILS = {
  owner: 'owner@oqariq.family',
  editor: 'family@oqariq.family',
} as const;

export type Role = 'viewer' | 'editor' | 'owner';

/** SHA-256 hex digest of a password, computed in the browser. */
export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
