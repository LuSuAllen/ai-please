import type { GeneratedRun, ReviewRecord, RuleUpdate } from '../types/game.ts';
import { DAY_IDS } from '../data/levels.ts';

const RUN_KEY = 'ai-please:run:v3';
const META_KEY = 'ai-please:meta:v3';
const LEGACY_RUN_KEY = 'ai-please:run:v2';
const LEGACY_META_KEY = 'ai-please:meta:v2';

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

/** v3 存档：种子 + 整局快照，刷新后续玩靠它，不再依赖任何写死的访客表。 */
export interface SavedRun {
  v: 3;
  seed: number;
  genVersion: number;
  day: string;
  total: number;
  run: GeneratedRun;
  index: number;
  score: number;
  funds: number;
  inspected: boolean;
  inspectedCount: number;
  records: ReviewRecord[];
  seenUpdates: number[];
  pendingUpdate: RuleUpdate | null;
  phase: 'playing' | 'feedback' | 'verdict';
  lastRecord: ReviewRecord | null;
}

export interface Meta {
  schema: 3;
  tutorialSeen: boolean;
  muted: boolean;
  bestScore: number;
  /** 每天的最好成绩 */
  bestByDay: Record<string, number>;
  /** 已解锁到哪一天 */
  unlockedDay: string;
}

const defaultMeta: Meta = {
  schema: 3,
  tutorialSeen: false,
  muted: false,
  bestScore: 0,
  bestByDay: {},
  unlockedDay: DAY_IDS[0],
};

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
  const raw = safeParse<Partial<Meta> & { schema?: number }>(readStorage(META_KEY));
  if (raw && raw.schema === 3) {
    return {
      ...defaultMeta,
      ...raw,
      bestByDay: { ...defaultMeta.bestByDay, ...(raw.bestByDay ?? {}) },
    };
  }
  // 旧版 meta 只保留教程状态/静音/最高分，不写回旧键
  const legacy = safeParse<{ tutorialSeen?: boolean; muted?: boolean; bestScore?: number }>(readStorage(LEGACY_META_KEY));
  if (!legacy) return { ...defaultMeta };
  return {
    ...defaultMeta,
    tutorialSeen: Boolean(legacy.tutorialSeen),
    muted: Boolean(legacy.muted),
    bestScore: Number.isFinite(legacy.bestScore) ? Number(legacy.bestScore) : 0,
  };
}

export function saveMeta(patch: Partial<Meta>): Meta {
  const current = loadMeta();
  const next = { ...current, ...patch, schema: 3 as const };
  // 最高分是玩家的资产：任何写入都不能把它改小
  next.bestScore = Math.max(current.bestScore, Number(patch.bestScore ?? 0), 0);
  try {
    if (typeof localStorage === 'undefined') return next;
    localStorage.setItem(META_KEY, JSON.stringify(next));
    clearStorageFailure('write');
  } catch (error) {
    reportStorageFailure('write', error);
  }
  return next;
}

function isRecord(value: unknown): value is ReviewRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Partial<ReviewRecord>;
  return (
    typeof r.visitorId === 'string' &&
    typeof r.code === 'string' &&
    (r.move === 'APPROVE' || r.move === 'DENY' || r.move === 'INSPECT') &&
    (r.correct === 'APPROVE' || r.correct === 'DENY') &&
    typeof r.isCorrect === 'boolean' &&
    typeof r.inspected === 'boolean' &&
    Number.isFinite(r.scoreDelta) &&
    Number.isFinite(r.fundDelta)
  );
}

function isValidRun(run: unknown): run is GeneratedRun {
  if (!run || typeof run !== 'object') return false;
  const r = run as Partial<GeneratedRun>;
  return (
    typeof r.seed === 'number' &&
    typeof r.genVersion === 'number' &&
    typeof r.day === 'string' &&
    typeof r.total === 'number' &&
    r.total >= 6 &&
    r.total <= 24 &&
    Array.isArray(r.visitors) &&
    r.visitors.length === r.total &&
    Array.isArray(r.rules) &&
    Array.isArray(r.updates) &&
    Array.isArray(r.events)
  );
}

/** v3 校验：人数、索引、记录数、逐条 correct 必须与快照访客一致 */
function validateSaved(raw: Partial<SavedRun>): SavedRun | null {
  if (raw.v !== 3 || !isValidRun(raw.run)) return null;
  const run = raw.run;
  const total = run.total;
  if (!Number.isInteger(raw.index) || (raw.index as number) < 0 || (raw.index as number) > total) return null;
  if (!Number.isFinite(raw.score) || !Number.isFinite(raw.funds)) return null;
  if (!Number.isInteger(raw.inspectedCount) || (raw.inspectedCount as number) < 0) return null;
  if (!Array.isArray(raw.records) || raw.records.length > total || !raw.records.every(isRecord)) return null;
  for (const record of raw.records) {
    const visitor = run.visitors.find((v) => v.id === record.visitorId);
    if (!visitor || visitor.correct !== record.correct) return null;
  }
  if (raw.seenUpdates !== undefined && (!Array.isArray(raw.seenUpdates) || raw.seenUpdates.some((i) => !Number.isInteger(i)))) {
    return null;
  }
  if (typeof raw.inspected !== 'boolean') return null;
  if (!['playing', 'feedback', 'verdict'].includes(raw.phase as string)) return null;
  return {
    v: 3,
    seed: run.seed,
    genVersion: run.genVersion,
    day: run.day,
    total,
    run,
    index: raw.index as number,
    score: raw.score as number,
    funds: raw.funds as number,
    inspected: raw.inspected,
    inspectedCount: raw.inspectedCount as number,
    records: raw.records,
    seenUpdates: raw.seenUpdates ?? [],
    pendingUpdate: (raw.pendingUpdate as RuleUpdate | null) ?? null,
    phase: raw.phase as SavedRun['phase'],
    lastRecord: (raw.lastRecord as ReviewRecord | null) ?? null,
  };
}

/**
 * 旧版 D00 快照按需加载：它是冻结的历史数据，只有 v2 老档迁移时才需要，
 * 因此不进首屏包（首屏预算 70kB gzip）。
 */
async function loadLegacyRun(): Promise<GeneratedRun> {
  const mod = await import('../data/legacy/run-d00.ts');
  return mod.D00_RUN;
}

/** v2 → D00：只读旧键，迁移后写 v3，旧键保留（回滚安全） */
async function migrateLegacy(): Promise<SavedRun | null> {
  const legacy = safeParse<{
    index?: number;
    score?: number;
    funds?: number;
    inspectedCount?: number;
    records?: ReviewRecord[];
    inspected?: boolean;
    seenUpdates?: number[];
    pendingUpdate?: RuleUpdate | null;
    phase?: 'playing' | 'feedback' | 'verdict';
    lastRecord?: ReviewRecord | null;
  }>(readStorage(LEGACY_RUN_KEY));
  if (!legacy) return null;
  const D00_RUN = await loadLegacyRun();
  const total = D00_RUN.total;
  if (!Number.isInteger(legacy.index) || (legacy.index as number) < 0 || (legacy.index as number) > total) return null;
  if (!Number.isFinite(legacy.score) || !Number.isFinite(legacy.funds)) return null;
  if (!Array.isArray(legacy.records) || !legacy.records.every(isRecord)) return null;
  const index = Math.min(legacy.index as number, total - 1);
  const saved: SavedRun = {
    v: 3,
    seed: D00_RUN.seed,
    genVersion: D00_RUN.genVersion,
    day: D00_RUN.day,
    total,
    run: D00_RUN,
    index,
    score: legacy.score as number,
    funds: legacy.funds as number,
    inspected: legacy.inspected ?? false,
    inspectedCount: legacy.inspectedCount ?? 0,
    records: legacy.records,
    seenUpdates: legacy.seenUpdates ?? [],
    pendingUpdate: legacy.pendingUpdate ?? null,
    phase: legacy.phase ?? 'playing',
    lastRecord: legacy.lastRecord ?? null,
  };
  saveRun(saved);
  return saved;
}

/** 同步读 v3 存档（不含 v2 迁移；迁移需要按需加载 D00 快照） */
export function loadRun(): SavedRun | null {
  const raw = safeParse<Partial<SavedRun>>(readStorage(RUN_KEY));
  if (!raw) return null;
  const saved = validateSaved(raw);
  if (saved) {
    if (saved.index >= saved.total) {
      return { ...saved, index: saved.total - 1, phase: 'verdict' };
    }
    return saved;
  }
  reportStorageFailure('read', new Error('存档格式无效，已保留原始数据'));
  return null;
}

/** 是否存在可以续玩的进度（v3 未打完，或还有未迁移的 v2 旧档） */
export function hasResumableSave(): boolean {
  const run = loadRun();
  if (run && run.index < run.total) return true;
  return readStorage(LEGACY_RUN_KEY) !== null;
}

/** 启动时用：优先 v3，其次把 v2 旧档迁移成 D00 一局 */
export async function loadRunAsync(): Promise<SavedRun | null> {
  const current = loadRun();
  if (current) return current;
  if (readStorage(LEGACY_RUN_KEY) === null) return null;
  return migrateLegacy();
}

export function saveRun(run: SavedRun): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const payload = JSON.stringify(run);
    // 20KB 预算：超出说明快照被塞了不该塞的东西，直接报错而不是静默写坏
    if (payload.length > 20 * 1024) {
      reportStorageFailure('write', new Error('存档超出 20KB 预算'));
      return false;
    }
    localStorage.setItem(RUN_KEY, payload);
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
