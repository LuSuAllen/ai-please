import test from 'node:test';
import assert from 'node:assert/strict';
import { amnestyActiveAt, isRegionOpen, openRegionsAt, ruleActiveAt } from '../src/game/zones.ts';
import type { GameEvent } from '../src/types/game.ts';

const EVENTS: GameEvent[] = [
  { kind: 'ruleIntro', index: 3, code: 'R06' },
  { kind: 'amnesty', index: 5, length: 3 },
  { kind: 'zoneChange', index: 6, opens: ['SG-03'], closes: ['TZ-07'] },
  { kind: 'ruleIntro', index: 8, code: 'R07' },
];

test('名单变更只在事件索引之后生效', () => {
  assert.equal(isRegionOpen(EVENTS, 'SG-03', 5), false);
  assert.equal(isRegionOpen(EVENTS, 'SG-03', 6), true);
  assert.equal(isRegionOpen(EVENTS, 'TZ-07', 5), true);
  assert.equal(isRegionOpen(EVENTS, 'TZ-07', 6), false);
  assert.ok(openRegionsAt(EVENTS, 0).includes('KA-01'));
  assert.ok(!openRegionsAt(EVENTS, 0).includes('BX-12'));
});

test('R06/R07 是"上线后生效"的规则，R01–R05 恒生效', () => {
  for (const code of ['R01', 'R02', 'R03', 'R04', 'R05']) {
    assert.equal(ruleActiveAt(EVENTS, code, 0), true, code);
  }
  assert.equal(ruleActiveAt(EVENTS, 'R06', 2), false);
  assert.equal(ruleActiveAt(EVENTS, 'R06', 3), true);
  assert.equal(ruleActiveAt(EVENTS, 'R07', 7), false);
  assert.equal(ruleActiveAt(EVENTS, 'R07', 8), true);
});

test('特赦窗口是左闭右开区间', () => {
  assert.equal(amnestyActiveAt(EVENTS, 4), false);
  assert.equal(amnestyActiveAt(EVENTS, 5), true);
  assert.equal(amnestyActiveAt(EVENTS, 7), true);
  assert.equal(amnestyActiveAt(EVENTS, 8), false);
});
