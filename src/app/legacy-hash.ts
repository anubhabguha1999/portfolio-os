/**
 * Map an old hash-router URL fragment to its clean-path equivalent, or null.
 *   #/resumes            → /resumes
 *   #/templates?t=atlas  → /templates?t=atlas
 *   #/view?p=PAYLOAD     → /view#p=PAYLOAD   (share data stays in the fragment, never sent to a server)
 */
export function legacyHashTarget(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const rest = hash.slice(1);
  const q = rest.indexOf('?');
  const path = q === -1 ? rest : rest.slice(0, q);
  const query = q === -1 ? '' : rest.slice(q + 1);
  if (path === '/view') {
    const p = new URLSearchParams(query).get('p');
    return p ? `/view#p=${p}` : '/view';
  }
  return `${path || '/'}${query ? `?${query}` : ''}`;
}
