import type { Mode, Move, ReviewRecord, Verdict, Visitor } from '../types/game';

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

export interface Ending {
  title: string;
  body: string;
}

export function endingOf(mode: Mode): Ending {
  if (mode === 'STRICT') {
    return {
      title: 'ENDING · 严格模式 / THE WALL',
      body:
        '你始终按最高优先级的条文执行，一次也没有越过名单。系统把你的记录归档为「规则宿主」——' +
        '指挥部很满意，因为墙需要一块不会思考的砖。下班时你又把 V-007 的档案翻出来看了一眼，然后合上了。',
    };
  }
  if (mode === 'HUMAN') {
    return {
      title: 'ENDING · 人文模式 / THE DOOR',
      body:
        '你在冲突处没有只问条文，而是问了「这个人现在需要什么」。V-007 的语言字段是维护事故，' +
        'V-010 的豁免令确实盖着指挥部的章。系统把你的记录归档为「边境缝隙」——不完美，但有些东西因此通过了。',
    };
  }
  return { title: 'ENDING · UNRESOLVED', body: '记录未归档。' };
}
