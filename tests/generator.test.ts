import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun, generateRunWithErrors } from '../src/game/generator.ts';
import { DAY_IDS, getBlueprint } from '../src/data/levels.ts';
import { validateRun } from '../src/game/validate.ts';

test('同 day + 同 seed 生成结果逐字节一致（指纹与判定全部可复现）', () => {
  for (const day of DAY_IDS) {
    const a = generateRun(day, 20261024);
    const b = generateRun(day, 20261024);
    assert.ok(a && b, day);
    assert.deepEqual(
      a.visitors.map((v) => [v.code, v.fingerprint, v.correct, v.templateId]),
      b.visitors.map((v) => [v.code, v.fingerprint, v.correct, v.templateId]),
      day,
    );
    assert.deepEqual(a.updates, b.updates);
  }
});

test('不同 seed / 不同 day 必须生成不同阵容', () => {
  const base = generateRun('D03', 500);
  const otherSeed = generateRun('D03', 501);
  const otherDay = generateRun('D02', 500);
  assert.ok(base && otherSeed && otherDay);
  assert.notDeepEqual(
    base.visitors.map((v) => v.fingerprint),
    otherSeed.visitors.map((v) => v.fingerprint),
  );
  assert.notDeepEqual(
    base.visitors.map((v) => v.fingerprint).slice(0, 8),
    otherDay.visitors.map((v) => v.fingerprint).slice(0, 8),
  );
});

test('生成结果带齐类型契约字段（访客索引/日期/指纹/事实）', () => {
  for (const day of DAY_IDS) {
    const run = generateRun(day, 77);
    assert.ok(run, day);
    const bp = getBlueprint(day);
    assert.ok(bp);
    assert.equal(run.total, bp.visitorCount);
    assert.equal(run.day, day);
    assert.equal(run.visitors.length, run.total);
    run.visitors.forEach((v, i) => {
      assert.equal(v.index, i);
      assert.equal(v.day, day);
      assert.match(v.code, /^V-\d{3}$/);
      assert.ok(v.fingerprint.length >= 8);
      assert.ok(v.avatarSeed >= 0 && v.avatarSeed < 1000);
      const dayNum = String(DAY_IDS.indexOf(day as (typeof DAY_IDS)[number]) + 1).padStart(2, '0');
      assert.ok(v.submittedAt.startsWith(`DAY ${dayNum} · `), v.submittedAt);
      const toMinutes = (stamp: string) => {
        const [hh, mm] = stamp.slice(-5).split(':');
        return Number(hh) * 60 + Number(mm);
      };
      if (i > 0) assert.ok(toMinutes(v.submittedAt) > toMinutes(run.visitors[i - 1].submittedAt));
      assert.equal(typeof v.facts.intentMatch, 'boolean');
    });
  }
});

test('每局都通过生成期不变量校验器', () => {
  for (const day of DAY_IDS) {
    for (const seed of [0, 1, 2, 12345, 20261024]) {
      const { run, errors } = generateRunWithErrors(day, seed);
      assert.ok(run, `${day}/${seed} 生成失败：${errors.join('; ')}`);
      assert.deepEqual(validateRun(run, getBlueprint(day) ?? undefined), [], `${day}/${seed}`);
    }
  }
});

test('未知关卡直接返回 null，不抛异常', () => {
  assert.equal(generateRun('D99', 1), null);
  assert.equal(generateRunWithErrors('D99', 1).run, null);
});
