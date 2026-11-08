import { useCallback, useEffect, useState } from 'react';
import {
  asRankApi,
  boardOfDay,
  isVersionSupported,
  readClientVersion,
  readMyRank,
  submitRunScore,
  type LeaderboardFailure,
  type LeaderboardPeriod,
  type MyRank,
  type XhsLike,
} from '../game/leaderboard';

/**
 * 结算页排行榜（内测）状态机。
 *
 * 只做三件事：提交本局成绩 → 读本周「我的名次」→ 前 100 名时补一次昵称。
 * 不做好友榜、不做头像、不做全量榜单；任何平台侧不可用都静默降级，
 * 绝不阻塞「再玩一次 / 返回主菜单」。
 */
export type RankView =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | { kind: 'error'; retryable: boolean }
  | { kind: 'ready'; my: MyRank; nickname: string | null };

/** 同一次提交（关卡 + 种子 + 分数）只上行一次；StrictMode 双挂载也不会重复提交 */
const submitted = new Set<string>();

const PERIOD: LeaderboardPeriod = 'week';

function currentPlatform(): XhsLike | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { xhs?: XhsLike }).xhs ?? null;
}

async function resolveClientVersion(xhs: XhsLike): Promise<number> {
  const sync = readClientVersion(xhs);
  if (sync > 0) return sync;
  const tool = xhs.miniTool;
  if (!tool || typeof tool.getLaunchOptions !== 'function') return 0;
  try {
    const options = await tool.getLaunchOptions();
    return readClientVersion({ launchOptions: options });
  } catch {
    return 0;
  }
}

/** 平台侧「不可用」一律隐身；只有可自愈的错误才给重试入口 */
function degrade(failure: LeaderboardFailure): RankView {
  if (failure.kind === 'not-ready' || failure.kind === 'rate' || failure.kind === 'network') {
    return { kind: 'error', retryable: true };
  }
  return { kind: 'hidden' };
}

export interface LeaderboardHook {
  view: RankView;
  retry: () => void;
}

export function useLeaderboardRank(input: {
  day: string | null;
  score: number;
  seed: number | null;
}): LeaderboardHook {
  const { day, score, seed } = input;
  const [view, setView] = useState<RankView>({ kind: 'hidden' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const board = boardOfDay(day);
    const xhs = currentPlatform();
    if (board === null || !xhs) {
      setView({ kind: 'hidden' });
      return;
    }
    const api = asRankApi(xhs);
    if (!api) {
      setView({ kind: 'hidden' });
      return;
    }

    let cancelled = false;
    setView({ kind: 'loading' });

    void (async () => {
      const version = await resolveClientVersion(xhs);
      if (!isVersionSupported(version)) {
        if (!cancelled) setView({ kind: 'hidden' });
        return;
      }

      const key = `${day}:${seed ?? 0}:${score}`;
      if (!submitted.has(key)) {
        submitted.add(key);
        const sent = await submitRunScore(api, board, score);
        if (!sent.ok) {
          if (!cancelled) setView(degrade(sent.error));
          return;
        }
      }

      const snapshot = await readMyRank(api, board, PERIOD);
      if (cancelled) return;
      if (!snapshot.ok) {
        setView(degrade(snapshot.error));
        return;
      }
      setView({ kind: 'ready', my: snapshot.value.my, nickname: snapshot.value.nickname });
    })();

    return () => {
      cancelled = true;
    };
  }, [day, score, seed, attempt]);

  return { view, retry };
}
