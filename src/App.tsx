import { useEffect, useState } from 'react';
import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ResultScreen } from './screens/ResultScreen';
import { useGame } from './hooks/useGame';
import { loadMeta, loadRun, type Meta } from './game/storage';

export default function App() {
  const { state, visitor, total, actions } = useGame();
  const [meta, setMeta] = useState<Meta>(() => loadMeta());
  const [savedIndex, setSavedIndex] = useState<number>(() => loadRun()?.index ?? 0);
  const [hasSave, setHasSave] = useState<boolean>(() => {
    const run = loadRun();
    return !!run && run.index > 0 && run.index < 10;
  });

  useEffect(() => {
    if (state.phase === 'home' || state.phase === 'result') {
      setMeta(loadMeta());
      const run = loadRun();
      setHasSave(!!run && run.index > 0 && run.index < 10);
      setSavedIndex(run?.index ?? 0);
    }
  }, [state.phase]);

  const isLast = state.index === total - 1;

  return (
    <div className="shell">
      {state.phase === 'home' ? (
        <HomeScreen
          onStart={actions.start}
          onResume={actions.resume}
          hasSave={hasSave}
          bestScore={meta.bestScore}
          savedIndex={savedIndex}
          total={total}
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
