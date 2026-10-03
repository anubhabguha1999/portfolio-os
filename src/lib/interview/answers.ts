/** Interview prep answers, stored locally in the `meta` store under one key. */
import { getMeta, setMeta } from '@/lib/storage/db';
import { emptyAnswer, type AnswerMap, type StarAnswer } from './questions';

export const ANSWERS_KEY = 'interview:answers';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function normalizeAnswers(raw: unknown): AnswerMap {
  if (!isObj(raw)) return {};
  const out: AnswerMap = {};
  for (const [id, v] of Object.entries(raw)) {
    if (!isObj(v)) continue;
    const base = emptyAnswer();
    const c = Number(v.confidence);
    out[id] = {
      situation: typeof v.situation === 'string' ? v.situation : base.situation,
      task: typeof v.task === 'string' ? v.task : base.task,
      action: typeof v.action === 'string' ? v.action : base.action,
      result: typeof v.result === 'string' ? v.result : base.result,
      confidence: (c === 1 || c === 2 || c === 3 ? c : 0) as StarAnswer['confidence'],
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '',
    };
  }
  return out;
}

export async function loadAnswers(): Promise<AnswerMap> {
  return normalizeAnswers(await getMeta(ANSWERS_KEY));
}

export async function saveAnswers(map: AnswerMap): Promise<void> {
  await setMeta(ANSWERS_KEY, map);
}
