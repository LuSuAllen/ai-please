import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesForEvents, updateForEvent } from '../src/data/rules.ts';
import type { GameEvent } from '../src/types/game.ts';

const EVENTS: GameEvent[] = [
  { kind: 'ruleIntro', index: 4, code: 'R06' },
  { kind: 'zoneChange', index: 7, opens: ['SG-03'], closes: ['TZ-07'] },
];

test('规则清单按事件时点装配，未上线的规则不出现', () => {
  assert.deepEqual(rulesForEvents([]).map((r) => r.code), ['R01', 'R02', 'R03', 'R04', 'R05']);
  const withR06 = rulesForEvents(EVENTS).map((r) => r.code);
  assert.ok(withR06.includes('R06'));
  assert.equal(withR06.includes('R07'), false);
  assert.equal(rulesForEvents(EVENTS).find((r) => r.code === 'R06')?.since, 4);
});

test('每条广播都能转成可展示的 RuleUpdate', () => {
  for (const event of EVENTS) {
    const update = updateForEvent(event);
    assert.ok(update.headline.length > 0);
    assert.ok(update.detail.length > 0);
    assert.equal(update.atIndex, event.index);
  }
});
