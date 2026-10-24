import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun } from '../src/game/generator.ts';
import { DAY_IDS } from '../src/data/levels.ts';
import { TEMPLATES } from '../src/data/templates.ts';
import { CARDS } from '../src/data/cards.ts';

test('模板池全覆盖：3 天合起来每个模板/手工卡都能被抽到', () => {
  const seen = new Set<string>();
  for (const day of DAY_IDS) {
    for (let seed = 0; seed < 60; seed += 1) {
      const run = generateRun(day, seed * 13 + 1);
      assert.ok(run);
      run.visitors.forEach((v) => seen.add(v.templateId));
    }
  }
  const expected = [...TEMPLATES, ...CARDS].map((t) => t.id);
  const missing = expected.filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], `未被抽到的模板：${missing.join(', ')}`);
});

test('单局内模板重复受控：同模板不会在相邻两位连续出现', () => {
  for (const day of DAY_IDS) {
    for (let seed = 0; seed < 30; seed += 1) {
      const run = generateRun(day, seed * 7 + 2);
      assert.ok(run);
      for (let i = 1; i < run.visitors.length; i += 1) {
        assert.notEqual(
          run.visitors[i].templateId,
          run.visitors[i - 1].templateId,
          `${day}/${seed} 第 ${i} 位与上一位同模板`,
        );
      }
    }
  }
});

test('同类服务/地区不连续重复 3 次以上（避免连续三关气质一样）', () => {
  for (const day of DAY_IDS) {
    for (let seed = 0; seed < 30; seed += 1) {
      const run = generateRun(day, seed * 11 + 5);
      assert.ok(run);
      for (let i = 2; i < run.visitors.length; i += 1) {
        const [a, b, c] = [run.visitors[i - 2], run.visitors[i - 1], run.visitors[i]];
        const sameService = a.serviceId === b.serviceId && b.serviceId === c.serviceId;
        const sameRegion = a.ipRegion === b.ipRegion && b.ipRegion === c.ipRegion;
        assert.equal(sameService, false, `${day}/${seed} 连续三同类服务 @${i}`);
        assert.equal(sameRegion, false, `${day}/${seed} 连续三同地区 @${i}`);
      }
    }
  }
});
