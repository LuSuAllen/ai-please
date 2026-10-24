import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_IDS, LEGACY_DAY_IDS, getBlueprint } from '../src/data/levels.ts';
import { LEVEL_SPECS, composeBlueprint, lintBlueprint } from '../src/data/specs.ts';
import { generateRun, generateRunWithErrors } from '../src/game/generator.ts';
import { TEMPLATES } from '../src/data/templates.ts';
import { CARDS } from '../src/data/cards.ts';
import { rulesForEvents } from '../src/data/rules.ts';

const KNOWN_CARDS = CARDS.map((c) => c.id);

test('配方区：每条 spec 过 linter（配额和 = 人数、槽位合法、事件按序）', () => {
  assert.ok(LEVEL_SPECS.length > 0, '至少有一条新关配方');
  const ids = new Set<string>();
  for (const spec of LEVEL_SPECS) {
    assert.equal(ids.has(spec.id), false, `配方重名：${spec.id}`);
    ids.add(spec.id);
    const errors = lintBlueprint(composeBlueprint(spec), KNOWN_CARDS);
    assert.deepEqual(errors, [], `${spec.id} 配方不合法：${errors.join(', ')}`);
    assert.ok(DAY_IDS.includes(spec.id), `${spec.id} 必须进 DAY_IDS，否则首页选不到`);
  }
});

test('加关不重排旧关：DAY_IDS 顺序 = 冻结区在前、配方区在后', () => {
  assert.deepEqual([...DAY_IDS].slice(0, LEGACY_DAY_IDS.length), [...LEGACY_DAY_IDS]);
  assert.equal(DAY_IDS.length, LEGACY_DAY_IDS.length + LEVEL_SPECS.length);
  for (const id of LEGACY_DAY_IDS) {
    assert.equal(LEVEL_SPECS.some((s) => s.id === id), false, `${id} 属于冻结区，不得再以配方定义`);
  }
});

test('冻结区不动：D01–D03 的人数与规则数保持 8/10/12 与 6/6/7', () => {
  const expected = [
    { day: 'D01', visitors: 8, rules: 6 },
    { day: 'D02', visitors: 10, rules: 6 },
    { day: 'D03', visitors: 12, rules: 7 },
  ];
  for (const row of expected) {
    const bp = getBlueprint(row.day);
    assert.ok(bp, `${row.day} 蓝图存在`);
    assert.equal(bp.visitorCount, row.visitors, `${row.day} 人数`);
    assert.equal(rulesForEvents(bp.events).length, row.rules, `${row.day} 规则数`);
  }
});

test('新关可生成：每条配方 24 个种子零失败、零校验错误', () => {
  for (const spec of LEVEL_SPECS) {
    for (let i = 0; i < 24; i += 1) {
      const seed = 1000 + i * 37;
      const { run, errors } = generateRunWithErrors(spec.id, seed);
      assert.ok(run, `${spec.id}/${seed} 生成失败：${errors.join(', ')}`);
      assert.equal(run.total, spec.visitorCount);
      assert.equal(run.visitors.length, spec.visitorCount);
    }
  }
});

test('新关判定唯一：每位访客都有明确结论，且需开档者带 warn/alert 提示', () => {
  for (const spec of LEVEL_SPECS) {
    const run = generateRun(spec.id, 20261024);
    assert.ok(run);
    for (const v of run.visitors) {
      assert.ok(v.correct === 'APPROVE' || v.correct === 'DENY', `${spec.id} ${v.code} 结论缺失`);
      assert.ok(v.templateId.length > 0);
      if (v.requiresInspect) {
        assert.ok(
          v.signals.some((s) => s.level === 'warn' || s.level === 'alert'),
          `${spec.id} ${v.code} 需开档却无警示信号`,
        );
      }
    }
    const approveRatio = run.visitors.filter((v) => v.correct === 'APPROVE').length / run.visitors.length;
    assert.ok(approveRatio >= 0.45 && approveRatio <= 0.68, `${spec.id} 放行率出界：${approveRatio}`);
  }
});

test('D04：16 位 / 7 条规则 / 名单变更早于特赦窗口', () => {
  const bp = getBlueprint('D04');
  assert.ok(bp, 'D04 蓝图存在');
  assert.equal(bp.visitorCount, 16);
  assert.equal(rulesForEvents(bp.events).length, 7);
  const zone = bp.events.find((e) => e.kind === 'zoneChange');
  const amnesty = bp.events.find((e) => e.kind === 'amnesty');
  assert.ok(zone && amnesty && zone.index < amnesty.index, '名单变更必须早于特赦窗口');
  const run = generateRun('D04', 20261024);
  assert.ok(run && run.total === 16);
  assert.ok(run.visitors.filter((v) => v.requiresInspect).length >= 1, 'D04 至少一位需要开档');
  assert.ok(TEMPLATES.length > 0);
});
