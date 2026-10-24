import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
  clear() { this.map.clear(); }
  get length() { return this.map.size; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
}

(globalThis as { localStorage?: MemoryStorage }).localStorage = new MemoryStorage();

const { saveRun, loadRun, loadRunAsync, clearRun, loadMeta, saveMeta, getStorageFailure } = await import(
  '../src/game/storage.ts'
);
const { generateRun } = await import('../src/game/generator.ts');
const { D00_RUN } = await import('../src/data/legacy/run-d00.ts');
const { D00_VISITORS } = await import('../src/data/legacy/visitors-d00.ts');

const RUN_KEY = 'ai-please:run:v3';
const META_KEY = 'ai-please:meta:v3';
const LEGACY_RUN_KEY = 'ai-please:run:v2';

function freshSave(day = 'D02', seed = 424242) {
  const run = generateRun(day, seed);
  assert.ok(run);
  return {
    v: 3 as const,
    seed: run.seed,
    genVersion: run.genVersion,
    day: run.day,
    total: run.total,
    run,
    index: 2,
    score: 260,
    funds: 900,
    inspected: false,
    inspectedCount: 1,
    records: [],
    seenUpdates: [],
    pendingUpdate: null,
    phase: 'playing' as const,
    lastRecord: null,
  };
}

test('v3 存档写入/读出字段一致', () => {
  (globalThis.localStorage as MemoryStorage).clear();
  const saved = freshSave();
  assert.equal(saveRun(saved), true);
  const loaded = loadRun();
  assert.ok(loaded);
  assert.equal(loaded.day, 'D02');
  assert.equal(loaded.index, 2);
  assert.equal(loaded.score, 260);
  assert.equal(loaded.run.visitors.length, saved.total);
  assert.equal(loaded.run.fingerprint ?? loaded.run.visitors[2].fingerprint, loaded.run.visitors[2].fingerprint);
});

test('损坏/不合规的 v3 存档被拒绝且不静默覆盖', () => {
  (globalThis.localStorage as MemoryStorage).clear();
  const saved = freshSave();
  const broken = { ...saved, run: { ...saved.run, visitors: saved.run.visitors.slice(0, 3) } };
  (globalThis.localStorage as MemoryStorage).setItem(RUN_KEY, JSON.stringify(broken));
  assert.equal(loadRun(), null);
  assert.equal((globalThis.localStorage as MemoryStorage).getItem(RUN_KEY)?.includes('"v":3'), true);
  assert.equal(getStorageFailure()?.operation, 'read');
});

test('记录里的 correct 必须与快照一致（防止改档刷分）', () => {
  (globalThis.localStorage as MemoryStorage).clear();
  const saved = freshSave();
  const visitor = saved.run.visitors[0];
  const tampered = {
    ...saved,
    records: [
      {
        visitorId: visitor.id,
        code: visitor.code,
        move: 'APPROVE',
        correct: visitor.correct === 'APPROVE' ? 'DENY' : 'APPROVE',
        isCorrect: true,
        scoreDelta: 100,
        fundDelta: 120,
        inspected: false,
      },
    ],
  };
  (globalThis.localStorage as MemoryStorage).setItem(RUN_KEY, JSON.stringify(tampered));
  assert.equal(loadRun(), null);
});

test('刷新到最后一格时不会越界（index 夹到 total-1）', () => {
  (globalThis.localStorage as MemoryStorage).clear();
  const saved = freshSave();
  (globalThis.localStorage as MemoryStorage).setItem(RUN_KEY, JSON.stringify({ ...saved, index: saved.total }));
  const loaded = loadRun();
  assert.ok(loaded);
  assert.equal(loaded.index, saved.total - 1);
  assert.equal(loaded.phase, 'verdict');
});

test('v2 旧档迁移成 D00 一局，最高分不丢且旧键保留', () => {
  const store = globalThis.localStorage as MemoryStorage;
  store.clear();
  store.setItem(LEGACY_RUN_KEY, JSON.stringify({
    index: 4,
    score: 320,
    funds: 715,
    inspectedCount: 2,
    inspected: false,
    records: [],
    seenUpdates: [3],
    pendingUpdate: null,
    phase: 'playing',
    lastRecord: null,
  }));
  saveMeta({ bestScore: 640 });

  return loadRunAsync().then((migrated) => {
    assert.ok(migrated);
    assert.equal(migrated.day, D00_RUN.day);
    assert.equal(migrated.total, 10);
    assert.equal(migrated.index, 4);
    assert.equal(migrated.score, 320);
    assert.equal(migrated.run.visitors.length, 10);

    // 旧键保留（回滚安全），新键已写入
    assert.ok(store.getItem(LEGACY_RUN_KEY));
    assert.ok(store.getItem(RUN_KEY));
    assert.equal(loadMeta().bestScore, 640);
    assert.equal(loadRun()?.day, D00_RUN.day);
  });
});

test('旧 meta 只继承教程状态/静音/最高分，不继承旧 schema', () => {
  const store = globalThis.localStorage as MemoryStorage;
  store.clear();
  store.setItem('ai-please:meta:v2', JSON.stringify({ tutorialSeen: true, muted: true, bestScore: 480 }));
  const meta = loadMeta();
  assert.equal(meta.schema, 3);
  assert.equal(meta.tutorialSeen, true);
  assert.equal(meta.muted, true);
  assert.equal(meta.bestScore, 480);
  assert.equal(meta.unlockedDay, 'D01');
});

test('最高分只会变高，不会因为差局被覆盖', () => {
  const store = globalThis.localStorage as MemoryStorage;
  store.clear();
  saveMeta({ bestScore: 700 });
  saveMeta({ bestScore: 120 });
  assert.equal(loadMeta().bestScore, 700);
  assert.ok(store.getItem(META_KEY));
});

test('超 20KB 的存档被拒绝写入并报错', () => {
  const store = globalThis.localStorage as MemoryStorage;
  store.clear();
  const saved = freshSave('D03', 5);
  const bloated = {
    ...saved,
    records: Array.from({ length: 60 }, () => ({
      visitorId: 'x'.repeat(400),
      code: 'V-001',
      move: 'APPROVE' as const,
      correct: 'APPROVE' as const,
      isCorrect: true,
      scoreDelta: 100,
      fundDelta: 120,
      inspected: false,
    })),
  };
  assert.equal(saveRun(bloated), false);
  assert.equal(getStorageFailure()?.operation, 'write');
  assert.equal(store.getItem(RUN_KEY), null);
});

test('clearRun 只删进度不删最高分', () => {
  const store = globalThis.localStorage as MemoryStorage;
  store.clear();
  saveRun(freshSave());
  saveMeta({ bestScore: 500 });
  clearRun();
  assert.equal(store.getItem(RUN_KEY), null);
  assert.equal(loadMeta().bestScore, 500);
  assert.equal(D00_VISITORS.length, 10);
});
