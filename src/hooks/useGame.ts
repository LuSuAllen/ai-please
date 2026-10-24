import { useCallback, useEffect, useMemo, useReducer, useSyncExternalStore } from 'react';
import { VISITORS } from '../data/visitors';
import { RULE_UPDATES } from '../data/rules';
import { FUNDS_TABLE, START_FUNDS, resolveReview } from '../game/engine';
import type { GameState, Mode, Move } from '../types/game';
import {
  clearRun,
  getStorageFailure,
  subscribeStorageFailure,
  loadMeta,
  loadRun,
  saveMeta,
  saveRun,
  type SavedRun,
} from '../game/storage';

type Action =
  | { type: 'START' }
  | { type: 'MOVE'; move: Move }
  | { type: 'INSPECT' }
  | { type: 'NEXT' }
  | { type: 'TOGGLE_RULES'; open?: boolean }
  | { type: 'ACK_UPDATE' }
  | { type: 'CLOSE_TUTORIAL' }
  | { type: 'MODE'; mode: Mode }
  | { type: 'RESTART' }
  | { type: 'HOME' }
  | { type: 'RESUME'; run: SavedRun };

function blankRun(): Pick<GameState, 'index' | 'score' | 'funds' | 'inspected' | 'inspectedCount' | 'records'> {
  return {
    index: 0,
    score: 0,
    funds: START_FUNDS,
    inspected: false,
    inspectedCount: 0,
    records: [],
  };
}

export function initialState(): GameState {
  return {
    phase: 'home',
    ...blankRun(),
    mode: null,
    seenUpdates: [],
    lastRecord: null,
    ruleDrawerOpen: false,
    pendingUpdate: null,
    tutorialOpen: false,
  };
}

function nextUpdateAt(index: number, seen: number[]) {
  return RULE_UPDATES.find((u) => u.atIndex === index && !seen.includes(u.atIndex)) ?? null;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        phase: 'playing',
        ...blankRun(),
        seenUpdates: RULE_UPDATES.filter((u) => u.atIndex === 0).map((u) => u.atIndex),
        lastRecord: null,
        mode: null,
        ruleDrawerOpen: false,
        pendingUpdate: null,
        tutorialOpen: !loadMeta().tutorialSeen,
      };

    case 'RESUME': {
      const { run } = action;
      const safeIndex = Math.min(Math.max(run.index, 0), VISITORS.length - 1);
      const completed = run.index >= VISITORS.length || run.records.length >= VISITORS.length;
      const seenUpdates = run.seenUpdates ?? RULE_UPDATES.filter((u) => u.atIndex < safeIndex).map((u) => u.atIndex);
      const phase = completed ? 'verdict' : (run.phase ?? 'playing');
      return {
        ...state,
        phase,
        index: safeIndex,
        score: run.score,
        funds: run.funds,
        inspected: run.inspected ?? (run.inspectedCount > run.records.filter((record) => record.inspected).length),
        inspectedCount: run.inspectedCount,
        records: run.records,
        seenUpdates,
        lastRecord: phase === 'feedback' ? (run.lastRecord ?? run.records[run.records.length - 1] ?? null) : null,
        mode: null,
        ruleDrawerOpen: false,
        pendingUpdate: phase === 'playing' ? nextUpdateAt(safeIndex, seenUpdates) : null,
        tutorialOpen: false,
      };
    }

    case 'MOVE': {
      if (state.phase !== 'playing' || state.pendingUpdate) return state;
      if (action.move === 'INSPECT') return reducer(state, { type: 'INSPECT' });
      const visitor = VISITORS[state.index];
      if (!visitor) return state;
      const record = resolveReview(visitor, action.move, state.inspected);
      return {
        ...state,
        phase: 'feedback',
        score: state.score + record.scoreDelta,
        funds: state.funds + record.fundDelta,
        records: [...state.records, record],
        lastRecord: record,
      };
    }

    case 'INSPECT': {
      if (state.phase !== 'playing' || state.pendingUpdate || state.inspected) return state;
      return {
        ...state,
        inspected: true,
        inspectedCount: state.inspectedCount + 1,
        funds: state.funds + FUNDS_TABLE.inspect,
      };
    }

    case 'NEXT': {
      if (state.phase !== 'feedback') return state;
      const nextIndex = state.index + 1;
      if (nextIndex >= VISITORS.length) {
        return { ...state, phase: 'verdict', lastRecord: null };
      }
      return {
        ...state,
        phase: 'playing',
        index: nextIndex,
        inspected: false,
        lastRecord: null,
        pendingUpdate: nextUpdateAt(nextIndex, state.seenUpdates),
      };
    }

    case 'TOGGLE_RULES':
      return {
        ...state,
        ruleDrawerOpen: action.open ?? !state.ruleDrawerOpen,
      };

    case 'ACK_UPDATE':
      return {
        ...state,
        pendingUpdate: null,
        seenUpdates: state.pendingUpdate
          ? [...state.seenUpdates, state.pendingUpdate.atIndex]
          : state.seenUpdates,
      };

    case 'CLOSE_TUTORIAL':
      saveMeta({ tutorialSeen: true });
      return { ...state, tutorialOpen: false };

    case 'MODE':
      return { ...state, mode: action.mode, phase: 'result' };

    case 'RESTART':
      return {
        ...state,
        phase: 'playing',
        ...blankRun(),
        mode: null,
        seenUpdates: [],
        lastRecord: null,
        ruleDrawerOpen: false,
        pendingUpdate: null,
        tutorialOpen: false,
      };

    case 'HOME':
      return { ...state, phase: 'home', lastRecord: null, ruleDrawerOpen: false, pendingUpdate: null };

    default:
      return state;
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const visitor = VISITORS[state.index];
  const total = VISITORS.length;

  // 进度落盘：刷新后可以接着审，不出现死局
  useEffect(() => {
    if (state.phase === 'playing' || state.phase === 'feedback' || state.phase === 'verdict') {
      saveRun({
        index: state.index,
        phase: state.phase,
        inspected: state.inspected,
        seenUpdates: state.seenUpdates,
        pendingUpdate: state.pendingUpdate,
        lastRecord: state.lastRecord,
        score: state.score,
        funds: state.funds,
        inspectedCount: state.inspectedCount,
        records: state.records,
      });
    }
  }, [state.phase, state.index, state.score, state.funds, state.inspectedCount, state.records,
    state.inspected, state.seenUpdates, state.pendingUpdate, state.lastRecord]);

  // 结算时写最高分并清空临时存档
  useEffect(() => {
    if (state.phase === 'result') {
      clearRun();
      const meta = loadMeta();
      if (state.score > meta.bestScore) saveMeta({ bestScore: state.score });
    }
  }, [state.phase, state.score]);

  const start = useCallback(() => dispatch({ type: 'START' }), []);
  const move = useCallback((m: Move) => dispatch({ type: 'MOVE', move: m }), []);
  const inspect = useCallback(() => dispatch({ type: 'INSPECT' }), []);
  const next = useCallback(() => dispatch({ type: 'NEXT' }), []);
  const toggleRules = useCallback((open?: boolean) => dispatch({ type: 'TOGGLE_RULES', open }), []);
  const ackUpdate = useCallback(() => dispatch({ type: 'ACK_UPDATE' }), []);
  const closeTutorial = useCallback(() => dispatch({ type: 'CLOSE_TUTORIAL' }), []);
  const chooseMode = useCallback((mode: Mode) => dispatch({ type: 'MODE', mode }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);
  const home = useCallback(() => dispatch({ type: 'HOME' }), []);

  const resume = useCallback(() => {
    const run = loadRun();
    if (run) dispatch({ type: 'RESUME', run });
  }, []);

  const storageFailure = useSyncExternalStore(subscribeStorageFailure, getStorageFailure, () => null);
  const savedRun = useMemo(() => loadRun(), []);

  return {
    state,
    visitor,
    total,
    savedRun,
    storageFailure,
    actions: {
      start,
      move,
      inspect,
      next,
      toggleRules,
      ackUpdate,
      closeTutorial,
      chooseMode,
      restart,
      home,
      resume,
    },
  };
}
