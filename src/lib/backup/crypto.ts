/**
 * Passphrase encryption for backup files (WebCrypto: PBKDF2-SHA-256 → AES-256-GCM).
 *
 * Layout of an encrypted file (`.pobackup`):
 *   0..7    magic "POBKENC1"
 *   8..11   PBKDF2 iterations (uint32, big-endian)
 *   12..27  salt (16 bytes)
 *   28..39  AES-GCM IV (12 bytes)
 *   40..    ciphertext + 16-byte tag
 * The 40-byte header is authenticated as additional data, so it cannot be altered silently.
 */

export const ENC_MAGIC = 'POBKENC1';
export const ENC_HEADER_BYTES = 40;
export const DEFAULT_ITERATIONS = 310_000;

export class BackupDecryptError extends Error {
  constructor(message = 'Wrong passphrase, or the file is damaged.') {
    super(message);
    this.name = 'BackupDecryptError';
  }
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser cannot encrypt files (WebCrypto is unavailable — the page must be served over HTTPS).');
  return s;
}

/** Copies into a fresh ArrayBuffer-backed view (WebCrypto rejects shared or foreign buffers). */
function own(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  out.set(bytes);
  return out;
}

export function isEncryptedBackup(bytes: Uint8Array): boolean {
  if (bytes.byteLength < ENC_HEADER_BYTES) return false;
  for (let i = 0; i < ENC_MAGIC.length; i++) if (bytes[i] !== ENC_MAGIC.charCodeAt(i)) return false;
  return true;
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey('raw', own(new TextEncoder().encode(passphrase.normalize('NFC'))), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', salt: own(salt), iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackup(plain: Uint8Array, passphrase: string, iterations = DEFAULT_ITERATIONS): Promise<Uint8Array> {
  if (!passphrase) throw new Error('Enter a passphrase to encrypt the backup.');
  const header = new Uint8Array(ENC_HEADER_BYTES);
  for (let i = 0; i < ENC_MAGIC.length; i++) header[i] = ENC_MAGIC.charCodeAt(i);
  new DataView(header.buffer).setUint32(8, iterations, false);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  header.set(salt, 12);
  header.set(iv, 28);
  const key = await deriveKey(passphrase, salt, iterations);
  const cipher = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: own(iv), additionalData: own(header) }, key, own(plain)));
  const out = new Uint8Array(ENC_HEADER_BYTES + cipher.byteLength);
  out.set(header, 0);
  out.set(cipher, ENC_HEADER_BYTES);
  return out;
}

export async function decryptBackup(bytes: Uint8Array, passphrase: string): Promise<Uint8Array> {
  if (!isEncryptedBackup(bytes)) throw new BackupDecryptError('This is not an encrypted backup file.');
  if (!passphrase) throw new BackupDecryptError('This backup is encrypted. Enter its passphrase.');
  const header = bytes.subarray(0, ENC_HEADER_BYTES);
  const iterations = new DataView(header.buffer, header.byteOffset, header.byteLength).getUint32(8, false);
  if (iterations < 1 || iterations > 10_000_000) throw new BackupDecryptError('The encrypted file header is damaged.');
  const salt = header.subarray(12, 28);
  const iv = header.subarray(28, 40);
  const key = await deriveKey(passphrase, salt, iterations);
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: own(iv), additionalData: own(header) }, key, own(bytes.subarray(ENC_HEADER_BYTES))));
  } catch {
    throw new BackupDecryptError();
  }
}
