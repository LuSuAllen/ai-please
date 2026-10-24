import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun, generateRunWithErrors } from '../src/game/generator.ts';
import { validateRun } from '../src/game/validate.ts';
import { DAY_IDS, getBlueprint } from '../src/data/levels.ts';
import { BALANCE, FORBIDDEN_WORDS, inspectQuota } from '../src/data/balance.ts';
import { TEMPLATES } from '../src/data/templates.ts';
import { CARDS } from '../src/data/cards.ts';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 3);

test('批量局全部通过不变量校验（含 oracle 复算）', () => {
  for (const day of DAY_IDS) {
    const bp = getBlueprint(day);
    assert.ok(bp);
    for (const seed of SEEDS) {
      const { run, errors } = generateRunWithErrors(day, seed);
      assert.ok(run, `${day}/${seed} 生成失败：${errors.join('; ')}`);
      assert.deepEqual(validateRun(run, bp), [], `${day}/${seed}`);
    }
  }
});

test('判定前可见文本不得泄题（禁词零命中）', () => {
  for (const day of DAY_IDS) {
    for (const seed of SEEDS.slice(0, 15)) {
      const run = generateRun(day, seed);
      assert.ok(run);
      for (const v of run.visitors) {
        const visible = [v.reason, v.device, ...v.signals.map((s) => s.label), ...v.hiddenClues].join(' ');
        for (const word of FORBIDDEN_WORDS) {
          assert.equal(visible.includes(word), false, `${day}/${seed} ${v.code} 含禁词「${word}」`);
        }
      }
    }
  }
});

test('配额与难度权重：每类模板数量符合蓝图，且不混入别的关卡专属卡', () => {
  for (const day of DAY_IDS) {
    const bp = getBlueprint(day);
    assert.ok(bp);
    for (const seed of SEEDS.slice(0, 12)) {
      const run = generateRun(day, seed);
      assert.ok(run);
      const counts: Record<string, number> = { N: 0, D: 0, A: 0, I: 0, S: 0, C: 0 };
      const byId = new Map([...TEMPLATES, ...CARDS].map((t) => [t.id, t]));
      for (const v of run.visitors) {
        const def = byId.get(v.templateId);
        assert.ok(def, `${day}/${seed} 未知模板 ${v.templateId}`);
        counts[def.group] += 1;
      }
      for (const [group, need] of Object.entries(bp.quota)) {
        assert.equal(counts[group], need, `${day}/${seed} ${group} 配额`);
      }
    }
  }
});

test('难度分档与终局压力在护栏内（准确率区间 + 开档额度）', () => {
  for (const day of DAY_IDS) {
    const bp = getBlueprint(day);
    assert.ok(bp);
    for (const seed of SEEDS.slice(0, 20)) {
      const run = generateRun(day, seed);
      assert.ok(run);
      const approved = run.visitors.filter((v) => v.correct === 'APPROVE').length;
      const ratio = approved / run.total;
      assert.ok(ratio >= BALANCE.approveMin - 1e-9, `${day}/${seed} 放行率偏低 ${ratio}`);
      assert.ok(ratio <= BALANCE.approveMax + 1e-9, `${day}/${seed} 放行率偏高 ${ratio}`);

      // 需要开档的访客（非手工冲突卡）不超过额度
      const inspectNeeded = run.visitors.filter((v) => v.requiresInspect && !v.templateId.startsWith('C-')).length;
      assert.ok(inspectNeeded <= inspectQuota(run.total), `${day}/${seed} 开档需求 ${inspectNeeded}`);
    }
  }
});

test('不允许出现"需要开档却没有任何可疑信号"的访客', () => {
  for (const day of DAY_IDS) {
    for (const seed of SEEDS.slice(0, 20)) {
      const run = generateRun(day, seed);
      assert.ok(run);
      for (const v of run.visitors) {
        if (!v.requiresInspect) continue;
        assert.ok(
          v.signals.some((s) => s.level === 'warn' || s.level === 'alert'),
          `${v.code} 需要开档却没有 warn/alert 信号`,
        );
      }
    }
  }
});
