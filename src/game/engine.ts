import type { Move, ReviewRecord, Verdict, Visitor } from '../types/game';

/** 评分数值 —— 单一来源，UI 与逻辑都从这里读 */
export const SCORE_TABLE = {
  correct: 100,
  wrongApprove: -150,
  wrongDeny: -100,
} as const;

export const FUNDS_TABLE = {
  correct: 120,
  wrongApprove: -200,
  wrongDeny: -120,
  inspect: -25,
} as const;

export const START_FUNDS = 1000;
export const STAMP_MS = 900;

export function isCorrect(move: Move, correct: Verdict): boolean {
  return (move === 'APPROVE' || move === 'DENY') && move === correct;
}

/** 计算一次审核的结果记录 */
export function resolveReview(visitor: Visitor, move: Move, inspected: boolean): ReviewRecord {
  const ok = isCorrect(move, visitor.correct);
  let scoreDelta = 0;
  let fundDelta = 0;

  if (ok) {
    scoreDelta = SCORE_TABLE.correct;
    fundDelta = FUNDS_TABLE.correct;
  } else if (move === 'APPROVE') {
    scoreDelta = SCORE_TABLE.wrongApprove;
    fundDelta = FUNDS_TABLE.wrongApprove;
  } else {
    scoreDelta = SCORE_TABLE.wrongDeny;
    fundDelta = FUNDS_TABLE.wrongDeny;
  }

  return {
    visitorId: visitor.id,
    code: visitor.code,
    move,
    correct: visitor.correct,
    isCorrect: ok,
    scoreDelta,
    fundDelta,
    inspected,
  };
}

export interface Grade {
  grade: string;
  tone: 'good' | 'mid' | 'bad';
  line: string;
}

export function gradeOf(score: number, total: number): Grade {
  const ratio = total > 0 ? score / (total * SCORE_TABLE.correct) : 0;
  if (ratio >= 0.9) {
    return { grade: 'S · 边境之星', tone: 'good', line: '指挥部将把你的判定流程写入训练手册。' };
  }
  if (ratio >= 0.6) {
    return { grade: 'A · 合格审核员', tone: 'good', line: '流程稳定，异常捕获率达标。' };
  }
  if (ratio >= 0.35) {
    return { grade: 'B · 待观察', tone: 'mid', line: '你放过了不该放过的东西，也拦住了不该拦的人。' };
  }
  return { grade: 'C · 系统弃用', tone: 'bad', line: '复核组已接管本窗口，请交出你的印章。' };
}
