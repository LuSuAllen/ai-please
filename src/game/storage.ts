import { VISITORS } from '../data/visitors';
import type { ReviewRecord, RuleUpdate } from '../types/game';

const RUN_KEY = 'ai-please:run:v2';
const META_KEY = 'ai-please:meta:v2';

type StorageOperation = 'read' | 'write' | 'delete';
export interface StorageFailure {
  operation: StorageOperation;
  message: string;
}

const storageListeners = new Set<() => void>();
let storageFailure: StorageFailure | null = null;

function reportStorageFailure(operation: StorageOperation, error: unknown) {
  const message = error instanceof Error ? error.message : '存档存储不可用';
  if (storageFailure?.operation === operation && storageFailure.message === message) return;
  storageFailure = { operation, message };
  storageListeners.forEach((listener) => listener());
}

/** 只有同名操作成功才清除提示：写成功不能证明删除可用。 */
function clearStorageFailure(operation: StorageOperation) {
  if (storageFailure && storageFailure.operation === operation) {
    storageFailure = null;
    storageListeners.forEach((listener) => listener());
  }
}

export function subscribeStorageFailure(listener: () => void): () => void {
  storageListeners.add(listener);
  return () => storageListeners.delete(listener);
}

export function getStorageFailure(): StorageFailure | null {
  return storageFailure;
}

export interface SavedRun {
  index: number;
  score: number;
  funds: number;
  inspectedCount: number;
  records: ReviewRecord[];
  /** v2 旧存档缺省时按未确认处理 */
  inspected?: boolean;
  seenUpdates?: number[];
  pendingUpdate?: RuleUpdate | null;
  phase?: 'playing' | 'feedback' | 'verdict';
  lastRecord?: ReviewRecord | null;
}

export interface Meta {
  tutorialSeen: boolean;
  bestScore: number;
  muted: boolean;
}

const defaultMeta: Meta = { tutorialSeen: false, bestScore: 0, muted: false };

function readStorage(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch (error) {
    reportStorageFailure('read', error);
    return null;
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    reportStorageFailure('read', error);
    return null;
  }
}

export function loadMeta(): Meta {
  return { ...defaultMeta, ...(safeParse<Partial<Meta>>(readStorage(META_KEY)) ?? {}) };
}

export function saveMeta(patch: Partial<Meta>): Meta {
  const next = { ...loadMeta(), ...patch };
  try {
    if (typeof localStorage === 'undefined') return next;
    localStorage.setItem(META_KEY, JSON.stringify(next));
    clearStorageFailure('write');
  } catch (error) {
    reportStorageFailure('write', error);
  }
  return next;
}

export function loadRun(): SavedRun | null {
  const run = safeParse<SavedRun>(readStorage(RUN_KEY));
  if (!run) return null;
  if (!Number.isInteger(run.index) || run.index < 0 || run.index > VISITORS.length ||
      !Number.isFinite(run.score) || !Number.isFinite(run.funds) ||
      !Number.isInteger(run.inspectedCount) || run.inspectedCount < 0 ||
      !Array.isArray(run.records) || run.records.some((record) => !record ||
        typeof record.visitorId !== 'string' || !Number.isFinite(record.scoreDelta) ||
        !Number.isFinite(record.fundDelta)) ||
      (run.seenUpdates !== undefined && (!Array.isArray(run.seenUpdates) ||
        run.seenUpdates.some((index) => !Number.isInteger(index)))) ||
      (run.inspected !== undefined && typeof run.inspected !== 'boolean') ||
      (run.phase !== undefined && !['playing', 'feedback', 'verdict'].includes(run.phase))) {
    reportStorageFailure('read', new Error('存档格式无效，请重新开始'));
    return null;
  }
  if (run.index === VISITORS.length || run.records.length === VISITORS.length) {
    return { ...run, index: VISITORS.length - 1, phase: 'verdict' };
  }
  return run;
}

export function saveRun(run: SavedRun): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
    clearStorageFailure('write');
    return true;
  } catch (error) {
    reportStorageFailure('write', error);
    return false;
  }
}

export function clearRun(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(RUN_KEY);
    clearStorageFailure('delete');
    return true;
  } catch (error) {
    reportStorageFailure('delete', error);
    return false;
  }
}
