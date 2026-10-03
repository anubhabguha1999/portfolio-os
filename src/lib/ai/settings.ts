/**
 * Assistant settings. The API key is kept in memory by default and stored in this
 * browser's IndexedDB only when the user turns on "Remember on this device".
 */
import { getMeta, setMeta } from '@/lib/storage/db';
import { AI_MODELS, DEFAULT_MODEL } from './client';

const KEY_META = 'ai:apiKey';
const MODEL_META = 'ai:model';

export async function loadApiKey(): Promise<string | null> {
  const v = await getMeta<string>(KEY_META);
  return typeof v === 'string' && v ? v : null;
}

/** Stores the key on this device, or removes it when `key` is null. */
export async function saveApiKey(key: string | null): Promise<void> {
  await setMeta(KEY_META, key ? key.trim() : null);
}

export async function loadModel(): Promise<string> {
  const v = await getMeta<string>(MODEL_META);
  return AI_MODELS.some((m) => m.id === v) ? v! : DEFAULT_MODEL;
}

export async function saveModel(model: string): Promise<void> {
  await setMeta(MODEL_META, model);
}
