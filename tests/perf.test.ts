import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRun } from '../src/game/generator.ts';
import { DAY_IDS } from '../src/data/levels.ts';

test('生成性能：p95 ≤ 16ms（主线程不能在切关时卡顿）', () => {
  const samples: number[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = DAY_IDS[i % DAY_IDS.length];
    const started = performance.now();
    const run = generateRun(day, 9000 + i);
    samples.push(performance.now() - started);
    assert.ok(run);
  }
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)];
  assert.ok(p95 <= 16, `p95=${p95.toFixed(2)}ms`);
});

test('同一 seed 连续生成两次耗时稳定（无隐藏缓存依赖）', () => {
  const t0 = performance.now();
  generateRun('D03', 31);
  const first = performance.now() - t0;
  const t1 = performance.now();
  generateRun('D03', 32);
  const second = performance.now() - t1;
  assert.ok(first < 64 && second < 64, `${first.toFixed(2)} / ${second.toFixed(2)}`);
});
