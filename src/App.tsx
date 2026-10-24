import { useEffect, useRef, useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useGame } from './hooks/useGame';
import { hasResumableSave, loadMeta, loadRun, loadRunAsync, type Meta, type SavedRun } from './game/storage';
import { getBlueprint } from './data/levels';

/** 验收脚本用 ?day=D01&seed=20261024 直接进入确定的一局；普通玩家不带参数。 */
function readLaunchRequest(): { day?: string; seed?: number } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const day = params.get('day') ?? undefined;
  const seedRaw = params.get('seed');
  const seed = seedRaw !== null && /^\d+$/.test(seedRaw) ? Number(seedRaw) : undefined;
  return { day: day && getBlueprint(day) ? day : undefined, seed };
}

export default function App() {
  const { state, visitor, total, actions, storageFailure } = useGame();
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [saved, setSaved] = useState<SavedRun | null>(() => loadRun());
  const launched = useRef(false);

  // v3 立刻可读；只有存在 v2 旧档时才按需加载 D00 快照做迁移
  useEffect(() => {
    if (state.phase !== 'home' && state.phase !== 'result') return;
    setMeta(loadMeta());
    let alive = true;
    const sync = loadRun();
    setSaved(sync);
    if (!sync) {
      loadRunAsync().then((migrated) => {
        if (alive && migrated) setSaved(migrated);
      });
    }
    return () => {
      alive = false;
    };
  }, [state.phase]);

  // 首屏自动开局：URL 带 seed 时跳过首页，方便脚本与复现同种子。
  // 但有未打完的进度时一律让玩家先看到 RESUME —— 刷新/分享链接不能吞掉存档。
  useEffect(() => {
    if (launched.current) return;
    launched.current = true;
    const launch = readLaunchRequest();
    if (launch.seed === undefined) return;
    if (hasResumableSave()) return;
    actions.start(launch.day, launch.seed);
  }, [actions]);

  const isLast = state.index === total - 1;

  return (
    <div className="shell">
      {storageFailure ? (
        <div className="storage-warning" role="status" aria-live="polite">
          本局尚未保存，仍可继续；刷新或关闭可能丢失进度。
        </div>
      ) : null}
      {state.phase === 'home' ? (
        <HomeScreen
          onStart={actions.start}
          onResume={() => {
            if (saved) actions.resume(saved);
          }}
          hasSave={saved !== null && saved.index < saved.total}
          meta={meta}
          savedIndex={saved?.index ?? 0}
          total={saved?.total ?? total}
        />
      ) : null}

      {state.phase === 'result' ? (
        <ResultScreen
          state={state}
          bestScore={meta.bestScore}
          onRestart={actions.restart}
          onHome={actions.home}
        />
      ) : null}

      {visitor && (state.phase === 'playing' || state.phase === 'feedback' || state.phase === 'verdict') ? (
        <GameScreen
          state={state}
          visitor={visitor}
          total={total}
          isLast={isLast}
          showVerdict={state.phase === 'verdict'}
          onMove={actions.move}
          onInspect={actions.inspect}
          onNext={actions.next}
          onOpenRules={() => actions.toggleRules(true)}
          onCloseRules={() => actions.toggleRules(false)}
          onAckUpdate={actions.ackUpdate}
          onCloseTutorial={actions.closeTutorial}
          onChooseMode={actions.chooseMode}
        />
      ) : null}
    </div>
  );
}
