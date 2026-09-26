export function uid(prefix = ''): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(36).padStart(2, '0');
  return prefix ? `${prefix}_${out.slice(0, 14)}` : out.slice(0, 14);
}
