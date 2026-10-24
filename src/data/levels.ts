import type { DayBlueprint } from '../types/game';
import { composeBlueprint, LEVEL_SPECS } from './specs.ts';

/**
 * 关卡蓝图：只描述"这一天的骨架"——人数、配额、事件时点、手工卡槽。
 * 随机只发生在蓝图之内；事件时点永不随机。
 */
export const BLUEPRINTS: Record<string, DayBlueprint> = {
  D01: {
    id: 'D01',
    label: 'DAY 01',
    visitorCount: 8,
    quota: { N: 3, D: 1, A: 2, I: 1, S: 1, C: 0 },
    events: [{ kind: 'ruleIntro', index: 4, code: 'R06' }],
    cardSlots: [
      {
        pool: 'S',
        candidates: [
          { index: 2, cardId: 'S-MAINT-UND' },
          { index: 3, cardId: 'S-FALSE-POSITIVE' },
          { index: 6, cardId: 'S-MAINT-UND' },
          { index: 7, cardId: 'S-FALSE-POSITIVE' },
        ],
      },
    ],
    allowCleanConfirm: false,
  },
  D02: {
    id: 'D02',
    label: 'DAY 02',
    visitorCount: 10,
    quota: { N: 3, D: 2, A: 3, I: 1, S: 1, C: 0 },
    events: [
      { kind: 'ruleIntro', index: 3, code: 'R06' },
      { kind: 'zoneChange', index: 7, opens: ['SG-03'], closes: ['TZ-07'] },
    ],
    cardSlots: [
      {
        pool: 'S',
        candidates: [
          { index: 2, cardId: 'S-FALSE-POSITIVE' },
          { index: 5, cardId: 'S-MAINT-UND' },
          { index: 6, cardId: 'S-FALSE-POSITIVE' },
          { index: 9, cardId: 'S-MAINT-UND' },
        ],
      },
    ],
    allowCleanConfirm: false,
  },
  D03: {
    id: 'D03',
    label: 'DAY 03',
    visitorCount: 12,
    quota: { N: 3, D: 2, A: 4, I: 1, S: 1, C: 1 },
    events: [
      { kind: 'ruleIntro', index: 3, code: 'R06' },
      { kind: 'amnesty', index: 5, length: 3 },
      { kind: 'zoneChange', index: 6, opens: ['SG-03'], closes: ['TZ-07'] },
      { kind: 'ruleIntro', index: 8, code: 'R07' },
    ],
    cardSlots: [
      {
        pool: 'S',
        candidates: [
          { index: 2, cardId: 'S-MAINT-UND' },
          { index: 5, cardId: 'S-AMNESTY' },
          { index: 6, cardId: 'S-AMNESTY' },
          { index: 9, cardId: 'S-MAINT-UND' },
        ],
      },
      {
        pool: 'C',
        candidates: [
          { index: 7, cardId: 'C-AMNESTY-BLOCKED' },
          { index: 8, cardId: 'C-EXEMPT-EXPIRED' },
          { index: 10, cardId: 'C-OVERRIDE' },
          { index: 11, cardId: 'C-OVERRIDE' },
        ],
      },
    ],
    allowCleanConfirm: true,
  },
};

/**
 * 冻结区：D01–D03 是手写字面量，快照哈希 `6ea6656d4ab9ad0e`（72 组）证明它们一字未动。
 * 新关只允许经 specs.ts 的配方进入，见 composeBlueprint / lintBlueprint。
 */
export const LEGACY_DAY_IDS = ['D01', 'D02', 'D03'] as const;

for (const spec of LEVEL_SPECS) {
  const bp = composeBlueprint(spec);
  if (BLUEPRINTS[bp.id]) throw new Error(`关卡配方与冻结蓝图重名：${bp.id}`);
  BLUEPRINTS[bp.id] = bp;
}

export const DAY_IDS = [...LEGACY_DAY_IDS, ...LEVEL_SPECS.map((s) => s.id)] as const;

export function getBlueprint(dayId: string): DayBlueprint | null {
  return BLUEPRINTS[dayId] ?? null;
}
