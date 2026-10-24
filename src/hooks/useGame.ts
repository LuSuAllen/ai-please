import { useCallback, useLayoutEffect, useReducer, useSyncExternalStore } from 'react';
import { FUNDS_TABLE, START_FUNDS, resolveReview } from '../game/engine.ts';
import { generateRun } from '../game/generator.ts';
import { DAY_IDS, getBlueprint } from '../data/levels.ts';
import type { GameState, GeneratedRun, Mode, Move, RuleUpdate } from '../types/game.ts';
import {
  clearRun,
  getStorageFailure,
  subscribeStorageFailure,
  loadMeta,
  saveMeta,
  saveRun,
  type SavedRun,
} from '../game/storage.ts';

type Action =
  | { type: 'START'; day: string; seed: number }
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
    run: null,
    mode: null,
    seenUpdates: [],
    lastRecord: null,
    ruleDrawerOpen: false,
    pendingUpdate: null,
    tutorialOpen: false,
  };
}

function nextUpdateAt(updates: RuleUpdate[], index: number, seen: number[]) {
  return updates.find((u) => u.atIndex === index && !seen.includes(u.atIndex)) ?? null;
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START': {
      let run: GeneratedRun | null = generateRun(action.day, action.seed);
      for (let bump = 1; !run && bump <= 3; bump += 1) run = generateRun(action.day, action.seed + bump);
      if (!run) return { ...state, phase: 'home' };
      return {
        ...state,
        phase: 'playing',
        ...blankRun(),
        run,
        seenUpdates: run.updates.filter((u) => u.atIndex === 0).map((u) => u.atIndex),
        lastRecord: null,
        mode: null,
        ruleDrawerOpen: false,
        pendingUpdate: null,
        tutorialOpen: !loadMeta().tutorialSeen,
      };
    }

    case 'RESUME': {
      const saved = action.run;
      if (!saved.run) return state;
      const total = saved.total;
      const safeIndex = Math.min(Math.max(saved.index, 0), total - 1);
      const completed = saved.index >= total || saved.records.length >= total;
      const phase = completed ? 'verdict' : saved.phase;
      return {
        ...state,
        phase,
        run: saved.run,
        index: safeIndex,
        score: saved.score,
        funds: saved.funds,
        inspected: saved.inspected,
        inspectedCount: saved.inspectedCount,
        records: saved.records,
        seenUpdates: saved.seenUpdates,
        lastRecord: phase === 'feedback' ? (saved.lastRecord ?? saved.records[saved.records.length - 1] ?? null) : null,
        mode: null,
        ruleDrawerOpen: false,
        pendingUpdate: phase === 'playing' ? nextUpdateAt(saved.run.updates, safeIndex, saved.seenUpdates) : null,
        tutorialOpen: false,
      };
    }

    case 'MOVE': {
      if (state.phase !== 'playing' || state.pendingUpdate || !state.run) return state;
      if (action.move === 'INSPECT') return reducer(state, { type: 'INSPECT' });
      const visitor = state.run.visitors[state.index];
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
      if (state.phase !== 'playing' || state.pendingUpdate || state.inspected || !state.run) return state;
      return {
        ...state,
        inspected: true,
        inspectedCount: state.inspectedCount + 1,
        funds: state.funds + FUNDS_TABLE.inspect,
      };
    }

    case 'NEXT': {
      if (state.phase !== 'feedback' || !state.run) return state;
      const nextIndex = state.index + 1;
      if (nextIndex >= state.run.total) {
        return { ...state, phase: 'verdict', lastRecord: null };
      }
      return {
        ...state,
        phase: 'playing',
        index: nextIndex,
        inspected: false,
        lastRecord: null,
        pendingUpdate: nextUpdateAt(state.run.updates, nextIndex, state.seenUpdates),
      };
    }

    case 'TOGGLE_RULES':
      return { ...state, ruleDrawerOpen: action.open ?? !state.ruleDrawerOpen };

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

    case 'RESTART': {
      if (!state.run) return { ...state, phase: 'home' };
      const run = generateRun(state.run.day, state.run.seed + 1) ?? state.run;
      return {
        ...state,
        phase: 'playing',
        ...blankRun(),
        run,
        mode: null,
        seenUpdates: run.updates.filter((u) => u.atIndex === 0).map((u) => u.atIndex),
        lastRecord: null,
        ruleDrawerOpen: false,
        pendingUpdate: null,
        tutorialOpen: false,
      };
    }

    case 'HOME':
      return { ...state, phase: 'home', lastRecord: null, ruleDrawerOpen: false, pendingUpdate: null };

    default:
      return state;
  }
}

/** 生成期随机只由 seed 决定；这里只负责"抽一个新种子"，不参与生成算法 */
function randomSeed(): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % 1_000_000_000;
  }
  return Math.floor(Math.random() * 1_000_000_000);
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const visitor = state.run ? state.run.visitors[state.index] : undefined;
  const total = state.run?.total ?? 0;

  // 进度落盘：刷新后可以接着审，不出现死局。
  // 用 layout effect 而不是 passive effect —— 落盘必须在本次提交内完成，
  // 否则"判定 → 立刻刷新"会读到上一位的状态（框架调度差异下会真实复现）。
  useLayoutEffect(() => {
    if (!state.run) return;
    if (state.phase === 'playing' || state.phase === 'feedback' || state.phase === 'verdict') {
      saveRun({
        v: 3,
        seed: state.run.seed,
        genVersion: state.run.genVersion,
        day: state.run.day,
        total: state.run.total,
        run: state.run,
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
    state.inspected, state.seenUpdates, state.pendingUpdate, state.lastRecord, state.run]);

  // 结算时写最高分、按日成绩并解锁下一天
  useLayoutEffect(() => {
    if (state.phase === 'result' && state.run) {
      clearRun();
      const meta = loadMeta();
      const day = state.run.day;
      const bestByDay = { ...meta.bestByDay, [day]: Math.max(meta.bestByDay[day] ?? 0, state.score) };
      const idx = DAY_IDS.indexOf(day as (typeof DAY_IDS)[number]);
      const nextDay = idx >= 0 && idx + 1 < DAY_IDS.length ? DAY_IDS[idx + 1] : meta.unlockedDay;
      const unlockedDay =
        DAY_IDS.indexOf(nextDay as (typeof DAY_IDS)[number]) > DAY_IDS.indexOf(meta.unlockedDay as (typeof DAY_IDS)[number])
          ? nextDay
          : meta.unlockedDay;
      saveMeta({
        bestScore: Math.max(meta.bestScore, state.score),
        bestByDay,
        unlockedDay,
      });
    }
  }, [state.phase, state.score, state.run]);

  const start = useCallback((day?: string, seed?: number) => {
    const target = day && getBlueprint(day) ? day : DAY_IDS[0];
    dispatch({ type: 'START', day: target, seed: seed ?? randomSeed() });
  }, []);
  const move = useCallback((m: Move) => dispatch({ type: 'MOVE', move: m }), []);
  const inspect = useCallback(() => dispatch({ type: 'INSPECT' }), []);
  const next = useCallback(() => dispatch({ type: 'NEXT' }), []);
  const toggleRules = useCallback((open?: boolean) => dispatch({ type: 'TOGGLE_RULES', open }), []);
  const ackUpdate = useCallback(() => dispatch({ type: 'ACK_UPDATE' }), []);
  const closeTutorial = useCallback(() => dispatch({ type: 'CLOSE_TUTORIAL' }), []);
  const chooseMode = useCallback((mode: Mode) => dispatch({ type: 'MODE', mode }), []);
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), []);
  const home = useCallback(() => dispatch({ type: 'HOME' }), []);

  const resume = useCallback((saved: SavedRun) => {
    dispatch({ type: 'RESUME', run: saved });
  }, []);

  const storageFailure = useSyncExternalStore(subscribeStorageFailure, getStorageFailure, () => null);

  return {
    state,
    visitor,
    total,
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
