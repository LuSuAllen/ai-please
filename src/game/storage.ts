import type { ReviewRecord } from '../types/game';

const RUN_KEY = 'ai-please:run:v2';
const META_KEY = 'ai-please:meta:v2';

export interface SavedRun {
  index: number;
  score: number;
  funds: number;
  inspectedCount: number;
  records: ReviewRecord[];
}

export interface Meta {
  tutorialSeen: boolean;
  bestScore: number;
  muted: boolean;
}

const defaultMeta: Meta = { tutorialSeen: false, bestScore: 0, muted: false };

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadMeta(): Meta {
  return { ...defaultMeta, ...(safeParse<Partial<Meta>>(localStorage.getItem(META_KEY)) ?? {}) };
}

export function saveMeta(patch: Partial<Meta>): Meta {
  const next = { ...loadMeta(), ...patch };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    /* 隐私模式下忽略写入失败 */
  }
  return next;
}

export function loadRun(): SavedRun | null {
  return safeParse<SavedRun>(localStorage.getItem(RUN_KEY));
}

export function saveRun(run: SavedRun): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    /* ignore */
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    /* ignore */
  }
}
