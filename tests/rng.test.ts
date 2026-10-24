import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, GEN_VERSION, hash32, masterSeed } from '../src/game/rng.ts';

test('hash32 是确定性的 32 位函数', () => {
  assert.equal(hash32('ai-please'), hash32('ai-please'));
  assert.notEqual(hash32('ai-please'), hash32('ai-please!'));
  for (const input of ['', 'a', 'D01|0', 'D03|999999']) {
    const value = hash32(input);
    assert.ok(Number.isInteger(value));
    assert.ok(value >= 0 && value <= 0xffffffff, `${input} → ${value}`);
  }
});

test('masterSeed 把 dayId 与 seed 一起绑定，避免跨天撞种子', () => {
  assert.equal(masterSeed('D01', 7), masterSeed('D01', 7));
  assert.notEqual(masterSeed('D01', 7), masterSeed('D02', 7));
  assert.notEqual(masterSeed('D01', 7), masterSeed('D01', 8));
});

test('同一 seed 的序列可复现，fork 出来的子流互不干扰', () => {
  const a = createRng(42).int(1000);
  const b = createRng(42).int(1000);
  assert.equal(a, b);

  const parent = createRng(42);
  const left = parent.fork('left').int(1000);
  const right = parent.fork('right').int(1000);
  const leftAgain = createRng(42).fork('left').int(1000);
  assert.equal(left, leftAgain);

  // fork 不改父流状态：父流后续取值与未 fork 时一致
  const fresh = createRng(42).fork('left');
  fresh.int(1000);
  const parentAfterFork = parent.int(1000);
  assert.equal(parentAfterFork, createRng(42).int(1000));
  assert.notEqual(left, right);
});

test('shuffle 只重排不增删', () => {
  const source = Array.from({ length: 20 }, (_, i) => i);
  const shuffled = createRng(9).shuffle(source);
  assert.deepEqual([...shuffled].sort((x, y) => x - y), source);
  assert.notDeepEqual(shuffled, source);
});

test('GEN_VERSION 是正整数（存档迁移依赖它）', () => {
  assert.ok(Number.isInteger(GEN_VERSION) && GEN_VERSION >= 1);
});
