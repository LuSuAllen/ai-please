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

/** 判定所需的结构化事实（不直接渲染；hiddenClues 才是展示给玩家的文本） */
export interface VisitorFacts {
  /** 访问理由与所申请服务用途一致 */
  intentMatch: boolean;
  /** 设备指纹命中黑名单（仅档案可见） */
  blacklisted: boolean;
  /** 账号注册时间晚于提交时间（仅档案可见） */
  registeredLate: boolean;
  /** 语言字段因区服维护被清空（仅档案可见） */
  langMaintenance: boolean;
}

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
  /** 生成元数据 */
  templateId: string;
  day: string;
  index: number;
  requiresInspect: boolean;
  fingerprint: string;
  facts: VisitorFacts;
}

export interface Region {
  code: string;
  name: string;
  timezone: string;
  language: string;
  /** 开局时是否在开放区名单内；之后由 zoneChange 事件改写 */
  baseOpen: boolean;
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

export type GameEvent =
  | { kind: 'ruleIntro'; index: number; code: string }
  | { kind: 'zoneChange'; index: number; opens: string[]; closes: string[] }
  | { kind: 'amnesty'; index: number; length: number };

/** 一局的完整快照：种子 + 生成结果（存档直接存它） */
export interface GeneratedRun {
  seed: number;
  genVersion: number;
  day: string;
  total: number;
  visitors: Visitor[];
  /** 本局出现的规则，since 已按事件重算 */
  rules: Rule[];
  updates: RuleUpdate[];
  events: GameEvent[];
}

export interface DayBlueprint {
  id: string;
  label: string;
  visitorCount: number;
  /** 每个槽位类别的数量：N 正常 D 干扰 A 异常 I 开档 S 特殊 C 冲突 */
  quota: { N: number; D: number; A: number; I: number; S: number; C: number };
  events: GameEvent[];
  /** 手工卡槽：候选 (index, cardId) 里按 rng 选一个 */
  cardSlots: { pool: 'S' | 'C'; candidates: { index: number; cardId: string }[] }[];
  allowCleanConfirm: boolean;
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
  /** 本局快照；home 阶段为 null */
  run: GeneratedRun | null;
}
