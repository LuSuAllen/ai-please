/** 核心类型定义 —— 游戏逻辑与 UI 解耦 */

export type Move = 'APPROVE' | 'DENY' | 'INSPECT';
export type Verdict = 'APPROVE' | 'DENY';

export type SignalLevel = 'info' | 'warn' | 'alert';

/** 访客卡片上直接可见的异常提示（不给答案，只给线索） */
export interface Signal {
  code: string;
  label: string;
  level: SignalLevel;
}

export type VisitorTier = 'normal' | 'anomaly' | 'inspect' | 'special' | 'conflict';

export interface Visitor {
  id: string;
  code: string;
  name: string;
  alias: string;
  avatarSeed: number;
  tier: VisitorTier;
  /** 申请信息 */
  ipRegion: string;
  timezone: string;
  language: string;
  accountRegion: string;
  serviceId: string;
  reason: string;
  device: string;
  submittedAt: string;
  /** 直接可见的异常提示 */
  signals: Signal[];
  /** 仅 INSPECT 后可见的额外线索 */
  hiddenClues: string[];
  /** 正确答案 */
  correct: Verdict;
  /** 判定依据 */
  explanation: string;
  /** 涉及规则编号 */
  ruleRefs: string[];
}

export interface Region {
  code: string;
  name: string;
  timezone: string;
  language: string;
  /** 从第几位访客开始进入开放区（0 = 开局即开放） */
  openFrom: number;
  /** 从第几位访客开始移出开放区（null = 始终开放） */
  openUntil: number | null;
  /** 从未进入开放区 */
  neverOpen: boolean;
}

export interface Service {
  id: string;
  name: string;
  intent: string;
}

export interface Rule {
  code: string;
  title: string;
  body: string;
  /** 从第几位访客开始生效 */
  since: number;
  grade: 'hard' | 'soft';
}

export interface RuleUpdate {
  /** 在第 N 位访客进入前推送 */
  atIndex: number;
  headline: string;
  detail: string;
}

export interface ReviewRecord {
  visitorId: string;
  code: string;
  move: Move;
  correct: Verdict;
  isCorrect: boolean;
  scoreDelta: number;
  fundDelta: number;
  inspected: boolean;
}

export type GamePhase = 'home' | 'briefing' | 'playing' | 'feedback' | 'verdict' | 'result';
export type Mode = 'STRICT' | 'HUMAN';

export interface GameState {
  phase: GamePhase;
  index: number;
  score: number;
  funds: number;
  inspected: boolean;
  inspectedCount: number;
  records: ReviewRecord[];
  mode: Mode | null;
  /** 本轮是否已经弹出过规则更新 */
  seenUpdates: number[];
  lastRecord: ReviewRecord | null;
  ruleDrawerOpen: boolean;
  /** 当前待确认的规则更新广播 */
  pendingUpdate: RuleUpdate | null;
  /** 新手说明 */
  tutorialOpen: boolean;
}
