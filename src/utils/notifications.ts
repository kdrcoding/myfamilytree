/** Invite deep-link used by Settings “copy invite”. */
export function inviteUrl(): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const path = `${import.meta.env.BASE_URL || '/'}`.replace(/\/?$/, '/');
  return `${base}${path}?invite=1`;
}
