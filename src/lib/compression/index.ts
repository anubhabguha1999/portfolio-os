import { deflateSync, inflateSync, gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate';

export function gzipJson(value: unknown): Uint8Array {
  return gzipSync(strToU8(JSON.stringify(value)), { level: 6 });
}

export function gunzipJson<T = unknown>(data: Uint8Array): T {
  return JSON.parse(strFromU8(gunzipSync(data))) as T;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** JSON → raw deflate → base64url. Used for share links (URL fragment). */
export function encodePayload(value: unknown): string {
  return toBase64Url(deflateSync(strToU8(JSON.stringify(value)), { level: 9 }));
}

export function decodePayload<T = unknown>(encoded: string): T {
  return JSON.parse(strFromU8(inflateSync(fromBase64Url(encoded.trim())))) as T;
}
