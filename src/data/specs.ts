import type { DayBlueprint } from '../types/game';

/**
 * 关卡配方（第十轮引入）。
 *
 * 目的：让「加一关」从"手写 15 行蓝图 + 手工核算配额和"变成"写一条 spec + 编译器校验"。
 * 约束：
 *  - D01–D03 继续走 levels.ts 里冻结的字面量（`profile: 'legacy'`），快照哈希一并冻住；
 *  - 新关只允许通过本文件的 spec 进入，且必须过 `lintBlueprint`；
 *  - 生成器与判定器一行不改——编译器只产出现有的 `DayBlueprint` 形状。
 */

export interface LevelSpec {
  id: string;
  label: string;
  /** 幕：1 = 教学（D01–D03），2 = 名单战，3 = 法规战。仅用于文案与后续配方推导，不参与生成。 */
  act: 1 | 2 | 3;
  visitorCount: number;
  quota: DayBlueprint['quota'];
  events: DayBlueprint['events'];
  cardSlots: DayBlueprint['cardSlots'];
  allowCleanConfirm: boolean;
}

/**
 * 新关配方表。D01–D03 不在此表（冻结）。
 *
 * D04 的设计意图（相对 D03 的唯一新变量）：
 *  - 人数拉到 16（封顶曲线验证：16 是存档体积与单局时长的上限）；
 *  - 名单变更提前到第 6 位、特赦窗口后移到 8–10、R07 推迟到第 11 位：
 *    前 5 位只有 R01–R05 可依，玩家必须先把「昨日经验」搁下，重新读当天的六条；
 *  - 手工卡从 2 张扩到 2 张但候选池覆盖到第 13 位，S/C 冲突对撞发生在后半场。
 */
export const LEVEL_SPECS: LevelSpec[] = [
  {
    id: 'D04',
    label: 'DAY 04',
    act: 2,
    visitorCount: 16,
    quota: { N: 4, D: 3, A: 6, I: 1, S: 1, C: 1 },
    events: [
      { kind: 'ruleIntro', index: 3, code: 'R06' },
      { kind: 'zoneChange', index: 6, opens: ['SG-03'], closes: ['TZ-07'] },
      { kind: 'amnesty', index: 8, length: 3 },
      { kind: 'ruleIntro', index: 11, code: 'R07' },
    ],
    cardSlots: [
      {
        pool: 'S',
        candidates: [
          { index: 7, cardId: 'S-MAINT-UND' },
          { index: 8, cardId: 'S-AMNESTY' },
          { index: 9, cardId: 'S-AMNESTY' },
          { index: 12, cardId: 'S-MAINT-UND' },
        ],
      },
      {
        pool: 'C',
        candidates: [
          { index: 10, cardId: 'C-AMNESTY-BLOCKED' },
          { index: 11, cardId: 'C-EXEMPT-EXPIRED' },
          { index: 13, cardId: 'C-OVERRIDE' },
          { index: 14, cardId: 'C-OVERRIDE' },
        ],
      },
    ],
    allowCleanConfirm: true,
  },
];

const EVENT_KINDS = ['ruleIntro', 'zoneChange', 'amnesty'] as const;
const RULE_CODES: readonly string[] = ['R06', 'R07'];

/** spec → 现有蓝图类型（深拷贝，避免调用方改到配方常量） */
export function composeBlueprint(spec: LevelSpec): DayBlueprint {
  return {
    id: spec.id,
    label: spec.label,
    visitorCount: spec.visitorCount,
    quota: { ...spec.quota },
    events: spec.events.map((e) => ({ ...e })),
    cardSlots: spec.cardSlots.map((p) => ({ pool: p.pool, candidates: p.candidates.map((c) => ({ ...c })) })),
    allowCleanConfirm: spec.allowCleanConfirm,
  };
}

/**
 * 编译期 linter（I15–I18 的配方侧投影）。只在测试与脚本里跑，不进产物。
 * 返回人类可读错误；空数组 = 通过。
 */
export function lintBlueprint(bp: DayBlueprint, knownCards: readonly string[] = []): string[] {
  const errors: string[] = [];
  const quotaSum = Object.values(bp.quota).reduce((a, b) => a + b, 0);
  if (quotaSum !== bp.visitorCount) errors.push(`I15:quota-sum:${quotaSum}/${bp.visitorCount}`);
  if (bp.visitorCount < 6 || bp.visitorCount > 24) errors.push(`I15:count-range:${bp.visitorCount}`);

  const used = new Set<number>();
  for (const pool of bp.cardSlots) {
    for (const c of pool.candidates) {
      if (c.index < 0 || c.index >= bp.visitorCount) errors.push(`I16:slot-range:${pool.pool}:${c.index}`);
      if (used.has(c.index)) errors.push(`I16:slot-dup:${c.index}`);
      used.add(c.index);
      if (knownCards.length && !knownCards.includes(c.cardId)) errors.push(`I16:card-unknown:${c.cardId}`);
    }
    if (!pool.candidates.length) errors.push(`I16:slot-empty:${pool.pool}`);
  }

  let last = -1;
  for (const e of bp.events) {
    if (!EVENT_KINDS.includes(e.kind)) errors.push(`I17:kind:${e.kind}`);
    if (e.index < 0 || e.index >= bp.visitorCount) errors.push(`I17:range:${e.kind}@${e.index}`);
    if (e.index <= last) errors.push(`I17:order:${e.kind}@${e.index}`);
    last = e.index;
    if (e.kind === 'ruleIntro' && !RULE_CODES.includes(e.code)) errors.push(`I17:rule:${e.code}`);
    if (e.kind === 'amnesty' && (!e.length || e.length < 2 || e.index + e.length > bp.visitorCount)) {
      errors.push(`I17:amnesty-window:${e.index}+${e.length}`);
    }
    if (e.kind === 'zoneChange' && (!e.opens?.length || !e.closes?.length)) errors.push('I17:zone-shape');
  }
  return errors;
}

/** 供测试与快照脚本判断某关是否走配方（true = 新关，false = 冻结的 legacy 字面量） */
export const COMPOSED_DAY_IDS = LEVEL_SPECS.map((s) => s.id);
