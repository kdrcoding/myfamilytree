/**
 * Access control for owner tools.
 *
 * Visitors enter only their name (no family password in the client bundle).
 * They become editors so Kadir can see who changed what. The owner password
 * still unlocks delete / settings / owner tools.
 *
 * The actual owner password is written down in the local `password/` folder,
 * which is git-ignored and never deployed — only this one-way hash ships
 * with the site. Never put plaintext passwords in this file or in VITE_ env.
 *
 * CHANGE THE OWNER PASSWORD before sharing if needed. Generate a new hash on
 * the Settings page ("Access" section), paste it here, update
 * password/passwords.txt, then redeploy.
 */
export const ACCESS = {
  /** SHA-256 hash of the owner password. */
  ownerHash: '39f2df21ef6aecdc8a706868252ef11e46afda2beecdcfc471109870faf1ff8e',
  /** SHA-256 hash of the legacy family editor password (optional upgrade path). */
  editorHash: '7fcc57f15a0a35995b1ef5fe78808863346e806aa2b86128c48c0133749c7586',
} as const;

/** Display name used for the owner account (no name prompt after unlock). */
export const OWNER_DEFAULT_NAME = 'Kadir';

/**
 * Supabase Auth accounts. Owner JWT is required for deletes, relationship
 * writes, and telegram settings. Name-only visitors use the anon key;
 * RLS allows anon the same family read/write editors already had.
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
