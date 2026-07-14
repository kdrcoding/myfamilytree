/**
 * Access control for edit mode.
 *
 * Two passwords unlock editing (the actual passwords are written down in the
 * local `password/` folder, which is git-ignored and never deployed — only
 * these one-way hashes ship with the site):
 *  - OWNER: can add, edit AND delete people, change relationships, reset the
 *    data and replace it via import.
 *  - EDITOR (member password): can add people and fill in MISSING info on
 *    existing people. Cannot delete, cannot overwrite existing details,
 *    cannot change relationships, cannot replace or reset the data. Share
 *    this one with family members who help maintain the tree.
 *
 * CHANGE THE PASSWORDS before sharing your site. Generate a new hash on the
 * Settings page ("Access" section), paste it here, update password/passwords.txt,
 * then redeploy.
 *
 * IMPORTANT HONESTY NOTE: this is a static website with no server, so this is
 * a convenience lock, not real security. It reliably prevents accidental or
 * casual changes, but a technically skilled visitor could bypass it. Every
 * visitor also edits only their OWN browser copy of the data — see the README
 * ("Collaborating with family") for how to merge a family member's additions
 * back into the deployed site via JSON export/import.
 */
export const ACCESS = {
  /** SHA-256 hash of the owner password. */
  ownerHash: '39f2df21ef6aecdc8a706868252ef11e46afda2beecdcfc471109870faf1ff8e',
  /** SHA-256 hash of the family editor password. */
  editorHash: '7fcc57f15a0a35995b1ef5fe78808863346e806aa2b86128c48c0133749c7586',
} as const;

export type Role = 'viewer' | 'editor' | 'owner';

/** SHA-256 hex digest of a password, computed in the browser. */
export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
