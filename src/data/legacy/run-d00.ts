import type { GameEvent, GeneratedRun } from '../../types/game.ts';
import { rulesForEvents, updateForEvent } from '../rules.ts';
import { D00_VISITORS } from './visitors-d00.ts';

/**
 * 旧版固定阵容冻结成的 D00 关卡快照。
 * 目的：v2 存档迁移后仍能原地续玩，且旧档的判定/分值完全不变。
 */
const EVENTS: GameEvent[] = [
  { kind: 'ruleIntro', index: 3, code: 'R06' },
  { kind: 'zoneChange', index: 6, opens: ['SG-03'], closes: ['TZ-07'] },
  { kind: 'ruleIntro', index: 8, code: 'R07' },
];

export const D00_RUN: GeneratedRun = {
  seed: 0,
  genVersion: 0,
  day: 'D00',
  total: D00_VISITORS.length,
  visitors: D00_VISITORS,
  rules: rulesForEvents(EVENTS),
  updates: EVENTS.map((event) => updateForEvent(event)),
  events: EVENTS,
};
