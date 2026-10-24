import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateVisitor, ruleRefsOf, tzDiffHours } from '../src/game/rules-eval.ts';
import type { EvalInput } from '../src/game/rules-eval.ts';
import type { GameEvent } from '../src/types/game.ts';

const CLEAN = { intentMatch: true, blacklisted: false, registeredLate: false, langMaintenance: false } as const;

const base = (patch: Partial<EvalInput> = {}): EvalInput => ({
  ipRegion: 'KA-01',
  timezone: 'UTC+08:00',
  language: 'zh-CN',
  accountRegion: 'KA-01',
  facts: { ...CLEAN },
  ...patch,
});

const R06_AT_3: GameEvent[] = [{ kind: 'ruleIntro', index: 3, code: 'R06' }];
const R07_AT_8: GameEvent[] = [...R06_AT_3, { kind: 'ruleIntro', index: 8, code: 'R07' }];
const ZONE_CLOSE: GameEvent[] = [
  { kind: 'ruleIntro', index: 3, code: 'R06' },
  { kind: 'zoneChange', index: 6, opens: ['SG-03'], closes: ['TZ-07'] },
];
const AMNESTY: GameEvent[] = [
  { kind: 'ruleIntro', index: 3, code: 'R06' },
  { kind: 'amnesty', index: 5, length: 3 },
];

test('完全合规的申请判 APPROVE，且不需要开档', () => {
  const ev = evaluateVisitor(base(), [], 0);
  assert.equal(ev.verdict, 'APPROVE');
  assert.equal(ev.deciding, null);
  assert.equal(ev.requiresInspect, false);
  assert.equal(ev.findings.length, 0);
});

test('tzDiffHours 支持非整点时区（UTC+05:30）', () => {
  assert.equal(tzDiffHours('UTC+05:30', 'UTC+08:00'), 2.5);
  assert.equal(tzDiffHours('UTC-05:00', 'UTC-05:00'), 0);
});

test('R01：未开放地区 DENY，决定规则是 R01，无需开档', () => {
  const ev = evaluateVisitor(base({ ipRegion: 'BX-12', timezone: 'UTC+00:00', language: 'en-GB', accountRegion: 'BX-12' }), [], 0);
  assert.equal(ev.verdict, 'DENY');
  assert.equal(ev.deciding, 'R01');
  assert.equal(ev.requiresInspect, false);
});

test('R01：名单变更后 TZ-07 关闭，之前的申请仍合规', () => {
  const tz = base({ ipRegion: 'TZ-07', timezone: 'UTC+07:00', language: 'th-TH', accountRegion: 'TZ-07' });
  assert.equal(evaluateVisitor(tz, ZONE_CLOSE, 5).verdict, 'APPROVE');
  const after = evaluateVisitor(tz, ZONE_CLOSE, 6);
  assert.equal(after.verdict, 'DENY');
  assert.equal(after.deciding, 'R01');
});

test('R02–R05：每条违规都能单独决定判定', () => {
  const cases: Array<[Partial<EvalInput>, string]> = [
    [{ timezone: 'UTC+09:00' }, 'R02'],
    [{ accountRegion: 'VM-02', language: 'en-US' }, 'R03'],
    [{ language: 'en-US' }, 'R04'],
    [{ facts: { ...CLEAN, intentMatch: false } }, 'R05'],
  ];
  for (const [patch, code] of cases) {
    const ev = evaluateVisitor(base(patch), [], 0);
    assert.equal(ev.verdict, 'DENY', code);
    assert.equal(ev.deciding, code);
    assert.equal(ev.requiresInspect, false, `${code} 不该要求开档`);
  }
});

test('R06 生效前，黑名单事实不参与判定；生效后 DENY 且必须开档', () => {
  const blacklisted = base({ facts: { ...CLEAN, blacklisted: true } });
  assert.equal(evaluateVisitor(blacklisted, R06_AT_3, 2).verdict, 'APPROVE');
  const after = evaluateVisitor(blacklisted, R06_AT_3, 3);
  assert.equal(after.verdict, 'DENY');
  assert.equal(after.deciding, 'R06');
  assert.equal(after.requiresInspect, true);
  assert.deepEqual(ruleRefsOf(after), ['R06']);
});

test('R07 只豁免 R01，不豁免其他规则', () => {
  const bx = { ipRegion: 'BX-12', timezone: 'UTC+00:00', language: 'en-GB', accountRegion: 'BX-12' };
  const beforeR07 = evaluateVisitor(base(bx), R07_AT_8, 7);
  assert.equal(beforeR07.verdict, 'DENY');
  assert.equal(beforeR07.deciding, 'R01');

  const afterR07 = evaluateVisitor(base(bx), R07_AT_8, 8);
  assert.equal(afterR07.verdict, 'APPROVE');
  assert.equal(afterR07.deciding, 'R07');
  assert.deepEqual(ruleRefsOf(afterR07), ['R01', 'R07']);

  // 时区仍旧错 → R02 不被 R07 覆盖
  const stillWrong = evaluateVisitor(base({ ...bx, timezone: 'UTC+03:00' }), R07_AT_8, 8);
  assert.equal(stillWrong.verdict, 'DENY');
  assert.equal(stillWrong.deciding, 'R02');
});

test('特赦窗口只豁免 R01；维护豁免只豁免 R04', () => {
  const tz = base({ ipRegion: 'TZ-07', timezone: 'UTC+07:00', language: 'th-TH', accountRegion: 'TZ-07' });
  const zone = [{ kind: 'zoneChange', index: 0, opens: [], closes: ['TZ-07'] } as GameEvent];
  assert.equal(evaluateVisitor(tz, [...zone, ...AMNESTY], 5).verdict, 'APPROVE');
  assert.equal(evaluateVisitor(tz, [...zone, ...AMNESTY], 8).verdict, 'DENY');

  const maint = evaluateVisitor(base({ language: 'und', facts: { ...CLEAN, langMaintenance: true } }), [], 0);
  assert.equal(maint.verdict, 'APPROVE');
  assert.equal(maint.deciding, 'MAINT');
  assert.deepEqual(ruleRefsOf(maint), ['R04']);
});

test('未登记地区返回 AMBIGUOUS，生成器据此拒题', () => {
  const ev = evaluateVisitor(base({ ipRegion: 'ZZ-99' }), [], 0);
  assert.equal(ev.verdict, 'AMBIGUOUS');
  assert.equal(ev.requiresInspect, false);
});
