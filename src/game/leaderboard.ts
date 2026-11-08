/**
 * 小红书小工具「排行榜（内测）」适配层。
 *
 * 契约来源：小工具在线文档 §3.17（2026-11-06）——
 *  - 客户端 9.51+；内测能力，可能随版本调整，不得作为核心功能的唯一依赖；
 *  - `submitScore({board, score})`：分数须为有限数且在 -1,000,000 ~ 1,000,000，
 *    返回的是「总榜历史最高分」，不是本局分数；
 *  - `getRankList({board, period})`：固定返回前 100 名 `{rank, score, nickname}`；
 *  - `getMyRank({board, period})`：返回 `{status, rank, score}`，必须先判 status；
 *  - `nickname` 由平台填充、仅在返回值中出现，不得自行采集或存储用户资料；
 *  - 未授权 errCode 1005 / 白名单 10003 → 隐藏入口并降级，不要重试。
 *
 * 本模块不直接摸 window：容器对象由调用方注入，因此全部逻辑可单测。
 */

/** 客户端 9.51.0：`buildVersion` 除以 1000 后与本值比较 */
export const MIN_CLIENT_VERSION = 9510;

export const MAX_ABS_SCORE = 1_000_000;
export const SCORE_MIN = -MAX_ABS_SCORE;
export const SCORE_MAX = MAX_ABS_SCORE;

/** 昵称展示上限（超出截断，不落盘、不做用户档案） */
export const NICKNAME_MAX_CHARS = 12;

/** 只剩两档：周榜是主场景，总榜用来满足「我到底几分」 */
export type LeaderboardPeriod = 'week' | 'all';

export const PERIODS: readonly LeaderboardPeriod[] = ['week', 'all'];

export type RankStatus = 'EXACT' | 'OVER_LIMIT' | 'NO_SCORE' | 'NOT_PARTICIPATING';

const RANK_STATUSES: readonly RankStatus[] = ['EXACT', 'OVER_LIMIT', 'NO_SCORE', 'NOT_PARTICIPATING'];

export interface RankRow {
  rank: number;
  score: number;
  nickname: string | null;
}

export interface MyRank {
  status: RankStatus;
  rank: number | null;
  score: number | null;
}

export type FailureKind =
  | 'unauthorized'
  | 'whitelist'
  | 'not-ready'
  | 'rate'
  | 'param'
  | 'score'
  | 'network'
  | 'unknown';

export interface LeaderboardFailure {
  kind: FailureKind;
  code: number | null;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; error: LeaderboardFailure };

/** 容器注入的最小能力面；缺任何一个都按「不支持」处理 */
export interface RankApi {
  submitScore(options: { board: number; score: number }): Promise<{ score?: number }>;
  getRankList(options: { board: number; period: LeaderboardPeriod }): Promise<{ data?: RankRow[] }>;
  getMyRank(options: { board: number; period: LeaderboardPeriod }): Promise<MyRank>;
}

export interface XhsLike {
  launchOptions?: { miniToolEnv?: { buildVersion?: number } };
  miniTool?: Partial<RankApi> & {
    getLaunchOptions?: () => Promise<{ miniToolEnv?: { buildVersion?: number } }>;
  };
}

/**
 * 榜位与关卡的唯一映射。board 5 预留给未来的周赛/活动，
 * 新增关卡必须在这里显式登记——不做「按顺序自动 +1」，
 * 否则两关分数口径不同却共用一个榜，比没做榜更糟。
 */
const DAY_BOARD: Readonly<Record<string, number>> = {
  D01: 1,
  D02: 2,
  D03: 3,
  D04: 4,
};

export function boardOfDay(day: string | null | undefined): number | null {
  if (!day) return null;
  return DAY_BOARD[day] ?? null;
}

export function isScoreSubmittable(score: number): boolean {
  return Number.isFinite(score) && score >= SCORE_MIN && score <= SCORE_MAX;
}

/** 去控制字符 + 折叠空白 + 截断；平台昵称可能为 null */
export function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const chars = Array.from(cleaned);
  if (chars.length <= NICKNAME_MAX_CHARS) return cleaned;
  return `${chars.slice(0, NICKNAME_MAX_CHARS).join('')}…`;
}

/** 前 100 名才拿得到昵称；排名在 101–500 时列表里没有我 */
export function pickNickname(rows: readonly RankRow[], my: MyRank): string | null {
  if (my.status !== 'EXACT' || my.rank === null) return null;
  const row = rows.find((item) => item.rank === my.rank);
  return row ? normalizeNickname(row.nickname) : null;
}

export function parseMyRank(raw: unknown): MyRank | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const status = (raw as { status?: unknown }).status;
  if (typeof status !== 'string' || !RANK_STATUSES.includes(status as RankStatus)) return null;
  const rank = (raw as { rank?: unknown }).rank;
  const score = (raw as { score?: unknown }).score;
  return {
    status: status as RankStatus,
    rank: typeof rank === 'number' && Number.isFinite(rank) ? rank : null,
    score: typeof score === 'number' && Number.isFinite(score) ? score : null,
  };
}

export function normalizeRows(raw: unknown): RankRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: RankRow[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const { rank, score } = item as { rank?: unknown; score?: unknown };
    if (typeof rank !== 'number' || typeof score !== 'number') continue;
    if (!Number.isFinite(rank) || !Number.isFinite(score)) continue;
    rows.push({ rank, score, nickname: normalizeNickname((item as { nickname?: unknown }).nickname) });
  }
  return rows;
}

/** 客户端版本：`buildVersion / 1000`，例如 9510004 → 9510（9.51.0） */
export function readClientVersion(xhs: XhsLike | null | undefined): number {
  const raw = xhs?.launchOptions?.miniToolEnv?.buildVersion;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value / 1000);
}

export function isVersionSupported(version: number): boolean {
  return version >= MIN_CLIENT_VERSION;
}

export function hasRankApi(xhs: XhsLike | null | undefined): xhs is XhsLike & { miniTool: RankApi } {
  const tool = xhs?.miniTool;
  return (
    !!tool &&
    typeof tool.submitScore === 'function' &&
    typeof tool.getRankList === 'function' &&
    typeof tool.getMyRank === 'function'
  );
}

export function asRankApi(xhs: XhsLike | null | undefined): RankApi | null {
  return hasRankApi(xhs) ? xhs.miniTool : null;
}

function errCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { errCode?: unknown }).errCode;
  return typeof code === 'number' && Number.isFinite(code) ? code : null;
}

/**
 * 错误码归一化（文档「云存储与排行榜错误码」）：
 * 1005 / 1006 未授权；10003 容器白名单拒绝；2002 榜单未就绪；
 * 2009 超出 150 QPS；1004 分数越界；网关失败不带 errCode。
 */
export function mapError(error: unknown): LeaderboardFailure {
  const code = errCodeOf(error);
  if (code === null) return { kind: 'network', code: null };
  if (code === 1005 || code === 1006) return { kind: 'unauthorized', code };
  if (code === 10003) return { kind: 'whitelist', code };
  if (code === 2002) return { kind: 'not-ready', code };
  if (code === 2009) return { kind: 'rate', code };
  if (code === 1004) return { kind: 'score', code };
  if (code === 1001 || code === 10001) return { kind: 'param', code };
  return { kind: 'unknown', code };
}

export type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 2002 才退避重试；其余错误立刻返回，不把配额打满 */
export const RETRY_DELAYS: readonly number[] = [0, 500, 1000, 2000];

export async function callWithRetry<T>(
  run: () => Promise<T>,
  sleep: Sleep = realSleep,
  delays: readonly number[] = RETRY_DELAYS,
): Promise<Outcome<T>> {
  let last: LeaderboardFailure = { kind: 'unknown', code: null };
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    try {
      return { ok: true, value: await run() };
    } catch (error) {
      last = mapError(error);
      if (last.kind !== 'not-ready') return { ok: false, error: last };
    }
  }
  return { ok: false, error: last };
}

export async function submitRunScore(
  api: RankApi,
  board: number,
  score: number,
  sleep: Sleep = realSleep,
): Promise<Outcome<{ score: number }>> {
  if (!isScoreSubmittable(score)) return { ok: false, error: { kind: 'score', code: 1004 } };
  const result = await callWithRetry(() => api.submitScore({ board, score }), sleep);
  if (!result.ok) return result;
  const best = Number(result.value?.score);
  return { ok: true, value: { score: Number.isFinite(best) ? best : score } };
}

export interface RankSnapshot {
  my: MyRank;
  nickname: string | null;
}

/**
 * 读「我的名次」。昵称只在前 100 名时才多打一次列表接口——
 * 这是唯一能拿到昵称的路径，getMyRank 不返回昵称。
 */
export async function readMyRank(
  api: RankApi,
  board: number,
  period: LeaderboardPeriod,
  sleep: Sleep = realSleep,
): Promise<Outcome<RankSnapshot>> {
  const mine = await callWithRetry(() => api.getMyRank({ board, period }), sleep);
  if (!mine.ok) return mine;

  const my = parseMyRank(mine.value);
  if (!my) return { ok: false, error: { kind: 'unknown', code: null } };

  let nickname: string | null = null;
  if (my.status === 'EXACT' && my.rank !== null && my.rank <= 100) {
    const list = await callWithRetry(() => api.getRankList({ board, period }), sleep);
    if (list.ok) nickname = pickNickname(normalizeRows(list.value?.data), my);
  }
  return { ok: true, value: { my, nickname } };
}
