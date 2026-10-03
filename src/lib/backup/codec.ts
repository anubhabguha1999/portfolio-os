/**
 * Structured-clone values ⇄ JSON-safe values.
 *
 * IndexedDB records can hold things JSON cannot (Blob, File, Uint8Array, ArrayBuffer, Date, Map,
 * Set, NaN). Binary data is pulled out into separate ZIP entries and replaced by a small tagged
 * object that references it; everything else is tagged inline. Plain objects that happen to use
 * the tag key themselves are escaped, so decoding is always unambiguous.
 */

export const TAG = '$pobk';

export class UnsupportedValueError extends Error {
  constructor(what: string) {
    super(`Cannot back up a value of type ${what}.`);
    this.name = 'UnsupportedValueError';
  }
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface BinarySink {
  /** Stores bytes and returns the ZIP path that references them. */
  add(bytes: Uint8Array): string;
}

export type BinarySource = (path: string) => Uint8Array | undefined;

const TYPED_ARRAYS: Record<string, new (buf: ArrayBuffer) => ArrayBufferView> = {
  Int8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
  DataView,
};

function tagOf(v: object): string {
  return Object.prototype.toString.call(v).slice(8, -1);
}

function isBlobLike(v: object): v is Blob {
  const t = tagOf(v);
  if (t === 'Blob' || t === 'File') return true;
  const b = v as Partial<Blob>;
  return typeof b.arrayBuffer === 'function' && typeof b.size === 'number' && typeof b.type === 'string' && typeof b.slice === 'function';
}

function isPlainObject(v: object): boolean {
  const proto = Object.getPrototypeOf(v);
  return proto === null || proto === Object.prototype || Object.getPrototypeOf(proto) === null;
}

/** Encodes one structured-clone value. Async because Blob contents are read. */
export async function encodeValue(value: unknown, sink: BinarySink): Promise<Json> {
  if (value === null) return null;
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : { [TAG]: 'num', v: String(value) };
    case 'undefined':
      return { [TAG]: 'undef' };
    case 'bigint':
      return { [TAG]: 'bigint', v: value.toString() };
    case 'object':
      break;
    default:
      throw new UnsupportedValueError(typeof value);
  }
  const obj = value as object;
  const t = tagOf(obj);
  if (Array.isArray(obj)) {
    const out: Json[] = [];
    for (const item of obj) out.push(await encodeValue(item, sink));
    return out;
  }
  if (t === 'Date') {
    const time = (obj as Date).getTime();
    return { [TAG]: 'date', v: Number.isNaN(time) ? null : new Date(time).toISOString() };
  }
  if (t === 'ArrayBuffer') return { [TAG]: 'buffer', p: sink.add(new Uint8Array((obj as ArrayBuffer).slice(0))) };
  if (ArrayBuffer.isView(obj)) {
    const bytes = new Uint8Array(obj.buffer.slice(obj.byteOffset, obj.byteOffset + obj.byteLength));
    if (t === 'Uint8Array') return { [TAG]: 'bytes', p: sink.add(bytes) };
    if (!(t in TYPED_ARRAYS)) throw new UnsupportedValueError(t);
    return { [TAG]: 'typed', c: t, p: sink.add(bytes) };
  }
  if (isBlobLike(obj)) {
    const bytes = new Uint8Array(await obj.arrayBuffer());
    const p = sink.add(bytes);
    if (t === 'File') {
      const f = obj as File;
      return { [TAG]: 'file', p, type: f.type, name: f.name, lastModified: f.lastModified };
    }
    return { [TAG]: 'blob', p, type: obj.type };
  }
  if (t === 'Map') {
    const entries: Json[] = [];
    for (const [k, v] of obj as Map<unknown, unknown>) entries.push([await encodeValue(k, sink), await encodeValue(v, sink)]);
    return { [TAG]: 'map', v: entries };
  }
  if (t === 'Set') {
    const items: Json[] = [];
    for (const v of obj as Set<unknown>) items.push(await encodeValue(v, sink));
    return { [TAG]: 'set', v: items };
  }
  if (!isPlainObject(obj)) throw new UnsupportedValueError(t);
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[k] = await encodeValue(v, sink);
  }
  return Object.prototype.hasOwnProperty.call(out, TAG) ? { [TAG]: 'obj', v: out } : out;
}

function need(src: BinarySource, path: unknown): Uint8Array {
  const bytes = typeof path === 'string' ? src(path) : undefined;
  if (!bytes) throw new Error(`Backup is missing binary entry ${String(path)}.`);
  return bytes;
}

/** Decodes a value produced by {@link encodeValue}. */
export function decodeValue(value: unknown, src: BinarySource): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => decodeValue(v, src));
  const o = value as Record<string, unknown>;
  const tag = o[TAG];
  if (typeof tag === 'string') {
    switch (tag) {
      case 'num':
        return Number(o.v);
      case 'undef':
        return undefined;
      case 'bigint':
        return BigInt(String(o.v));
      case 'date':
        return new Date(typeof o.v === 'string' ? o.v : NaN);
      case 'buffer':
        return new Uint8Array(need(src, o.p)).buffer;
      case 'bytes':
        return new Uint8Array(need(src, o.p));
      case 'typed': {
        const Ctor = TYPED_ARRAYS[String(o.c)];
        if (!Ctor) throw new Error(`Unknown typed array ${String(o.c)}.`);
        return new Ctor(new Uint8Array(need(src, o.p)).buffer);
      }
      case 'blob':
        return new Blob([need(src, o.p) as BlobPart], { type: typeof o.type === 'string' ? o.type : '' });
      case 'file': {
        const bytes = need(src, o.p) as BlobPart;
        const type = typeof o.type === 'string' ? o.type : '';
        if (typeof File === 'function') {
          return new File([bytes], typeof o.name === 'string' ? o.name : 'file', { type, lastModified: typeof o.lastModified === 'number' ? o.lastModified : undefined });
        }
        return new Blob([bytes], { type });
      }
      case 'map':
        return new Map((Array.isArray(o.v) ? o.v : []).map((pair) => [decodeValue((pair as unknown[])[0], src), decodeValue((pair as unknown[])[1], src)]));
      case 'set':
        return new Set((Array.isArray(o.v) ? o.v : []).map((v) => decodeValue(v, src)));
      case 'obj':
        return decodePlain(o.v as Record<string, unknown>, src);
      default:
        throw new Error(`Unknown value tag "${tag}".`);
    }
  }
  return decodePlain(o, src);
}

function decodePlain(o: Record<string, unknown>, src: BinarySource): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) out[k] = decodeValue(v, src);
  return out;
}
