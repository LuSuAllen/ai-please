/**
 * 双语注释层回归：英文契约不能丢，中文理解层不能漏。
 *
 * 数据层（src/data / src/game）不参与本测试——术语只允许存在于视图层 src/i18n。
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { RULE_BASE, rulesForEvents } from '../src/data/rules.ts';
import {
  METRIC_ZH,
  MOVE_ZH,
  RULE_ZH,
  STAMP_ZH,
  TIER_ZH,
  UI_ZH,
  VERDICT_ZH,
  WRONG_KIND_ZH,
} from '../src/i18n/terms.ts';

test('每条审核规则都有中文副注', () => {
  for (const rule of RULE_BASE) {
    const zh = RULE_ZH[rule.code];
    assert.equal(typeof zh, 'string', `${rule.code} 缺中文副注`);
    assert.ok(zh.length >= 2, `${rule.code} 中文副注过短: ${zh}`);
    assert.ok(!/[A-Za-z]/.test(zh), `${rule.code} 中文副注里混入英文: ${zh}`);
  }
});

test('中文副注不覆盖不存在的规则码', () => {
  const codes = new Set(RULE_BASE.map((rule) => rule.code));
  for (const code of Object.keys(RULE_ZH)) assert.ok(codes.has(code), `多余的规则码: ${code}`);
});

test('判定动作与风险等级全部有中文', () => {
  for (const move of ['APPROVE', 'DENY', 'INSPECT'] as const) {
    assert.ok(MOVE_ZH[move]?.length >= 2, `${move} 缺中文`);
  }
  for (const tier of ['normal', 'anomaly', 'inspect', 'special', 'conflict'] as const) {
    assert.ok(TIER_ZH[tier]?.length >= 1, `${tier} 缺中文`);
  }
});

test('规则子集裁剪后仍只含已注册规则码', () => {
  const live = rulesForEvents([{ type: 'runStart' } as never]);
  assert.ok(live.length > 0, '开局至少一条规则');
  for (const rule of live) assert.ok(RULE_ZH[rule.code], `${rule.code} 缺中文副注`);
});

test('判定反馈层术语齐全且为纯中文', () => {
  const chineseOnly = (label: string, value: string | undefined) => {
    assert.equal(typeof value, 'string', `${label} 缺中文`);
    assert.ok(!/[A-Za-z]/.test(value!), `${label} 混入英文: ${value}`);
    assert.ok(value!.length >= 2, `${label} 过短: ${value}`);
  };
  chineseOnly('判对印章', STAMP_ZH.correct);
  chineseOnly('判错印章', STAMP_ZH.wrong);
  chineseOnly('判对结论', VERDICT_ZH.correct);
  chineseOnly('判错结论', VERDICT_ZH.wrong);
  for (const [move, zh] of Object.entries(WRONG_KIND_ZH)) {
    assert.ok(!/[A-Za-z]/.test(zh), `错型归因混入英文: ${move}=${zh}`);
    assert.ok(/误放行|误拒绝/.test(zh), `错型归因必须说清方向: ${zh}`);
  }
  for (const [key, zh] of Object.entries(METRIC_ZH)) {
    assert.ok(!/[A-Za-z]/.test(zh), `账目标签混入英文: ${key}=${zh}`);
  }
  for (const [key, zh] of Object.entries(UI_ZH)) {
    assert.ok(!/[A-Za-z]/.test(zh), `操作词混入英文: ${key}=${zh}`);
  }
});
