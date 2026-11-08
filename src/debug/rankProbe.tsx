import { useEffect, useState } from 'react';
import {
  asRankApi,
  boardOfDay,
  isVersionSupported,
  mapError,
  readClientVersion,
  submitRunScore,
  type XhsLike,
} from '../game/leaderboard';

/** 构建期 define 注入：只有 `MINITOOL_RANK_DEBUG=1` 的产物才会渲染这块面板。 */
declare const __RANK_DEBUG__: boolean;

export const RANK_DEBUG_ENABLED: boolean =
  typeof __RANK_DEBUG__ !== 'undefined' && __RANK_DEBUG__ === true;

interface Line {
  k: string;
  v: string;
}

function short(value: unknown): string {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return 'unserializable';
  }
}

function errCodeOf(error: unknown): unknown {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return record.errCode ?? record.errno ?? record.code ?? null;
  }
  return null;
}

function errMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 70);
}

/**
 * 仅内测预览使用的自证面板：把「哪一道门把卡片挡住了」逐条打在屏幕上。
 * 生产包不会包含（define 关掉后整段被摇掉），它只用于定位容器能力与错误码。
 */
export function RankProbe() {
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    const host = window as unknown as { xhs?: XhsLike & { miniTool?: Record<string, unknown> } };
    const out: Line[] = [];
    const push = (k: string, v: unknown) => {
      out.push({ k, v: typeof v === 'string' ? v : short(v) });
      setLines([...out]);
    };

    void (async () => {
      push('ua', navigator.userAgent.slice(0, 70));
      const xhs = host.xhs;
      push('xhs', xhs ? 'yes' : 'NO');
      const tool = (xhs as unknown as { miniTool?: Record<string, unknown> } | undefined)?.miniTool;
      push('mtKeys', tool ? Object.keys(tool).join(',') : 'none');
      push('syncLaunch', (xhs as unknown as { launchOptions?: unknown })?.launchOptions);

      let buildVersion = readClientVersion(xhs);
      push('buildVersion(sync)', buildVersion * 1000);
      if (!buildVersion && tool && typeof tool.getLaunchOptions === 'function') {
        try {
          const options = (await (tool.getLaunchOptions as () => Promise<unknown>)()) as {
            miniToolEnv?: { buildVersion?: number };
          };
          buildVersion = readClientVersion({ launchOptions: options });
          push('launchOptions', options);
          push('buildVersion(async)', buildVersion * 1000);
        } catch (error) {
          push('launchOptions ERR', { code: errCodeOf(error), msg: errMessage(error) });
        }
      }
      push('ver>=9510', isVersionSupported(buildVersion) ? 'PASS' : 'FAIL(' + buildVersion + ')');

      const api = asRankApi(xhs);
      push('api', api ? 'ok' : 'missing');
      if (!api) return;

      const board = boardOfDay('D01') ?? 1;
      try {
        const raw = await api.getMyRank({ board, period: 'week' });
        push('getMyRank', raw);
      } catch (error) {
        push('getMyRank ERR', { code: errCodeOf(error), mapped: mapError(error), msg: errMessage(error) });
      }
      try {
        const raw = await api.submitScore({ board, score: 0 });
        push('submitScore', raw);
      } catch (error) {
        push('submitScore ERR', { code: errCodeOf(error), mapped: mapError(error), msg: errMessage(error) });
      }
      const sub = await submitRunScore(api, board, 0);
      push('submitMapped', sub.ok ? sub.value : sub.error);
    })();
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: 0,
        zIndex: 9999,
        maxHeight: '58vh',
        overflow: 'auto',
        background: '#000',
        color: '#3f6',
        font: '10px/1.4 ui-monospace, Menlo, monospace',
        padding: '4px 6px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      <div style={{ color: '#0ff' }}>RANK DEBUG（内部预览，不会进送审包）</div>
      {lines.map((line, index) => (
        <div key={index}>
          {line.k}: {line.v}
        </div>
      ))}
    </div>
  );
}
