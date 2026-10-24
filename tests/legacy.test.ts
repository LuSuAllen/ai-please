import test from 'node:test';
import assert from 'node:assert/strict';
import { D00_RUN } from '../src/data/legacy/run-d00.ts';
import { D00_VISITORS } from '../src/data/legacy/visitors-d00.ts';
import { evaluateVisitor } from '../src/game/rules-eval.ts';

test('D00 冻结局：10 位访客、编号连续、来源标记一致', () => {
  assert.equal(D00_RUN.total, 10);
  assert.equal(D00_RUN.visitors.length, 10);
  assert.equal(D00_RUN.day, 'D00');
  assert.equal(D00_RUN.seed, 0);
  assert.equal(D00_RUN.genVersion, 0);
  D00_RUN.visitors.forEach((v, i) => {
    assert.equal(v.code, `V-${String(i + 1).padStart(3, '0')}`);
    assert.equal(v.index, i);
    assert.equal(v.day, 'D00');
    assert.equal(v.templateId, 'LEGACY-D00');
    assert.equal(typeof v.requiresInspect, 'boolean');
    assert.ok(v.fingerprint.length > 0);
  });
});

test('D00 与旧版数据逐字段一致（迁移不能改变历史判定）', () => {
  assert.equal(D00_VISITORS.length, D00_RUN.visitors.length);
  for (const [i, visitor] of D00_RUN.visitors.entries()) {
    const legacy = D00_VISITORS[i];
    assert.equal(visitor.name, legacy.name);
    assert.equal(visitor.alias, legacy.alias);
    assert.equal(visitor.correct, legacy.correct);
    assert.deepEqual(visitor.ruleRefs, legacy.ruleRefs);
    assert.deepEqual(visitor.signals.map((s) => s.code), legacy.signals.map((s) => s.code));
    assert.deepEqual(visitor.hiddenClues, legacy.hiddenClues);
    assert.equal(visitor.submittedAt, legacy.submittedAt);
    assert.equal(visitor.explanation, legacy.explanation);
  }
});

test('D00 的答案与新版 oracle 复算一致（规则语义没被悄悄改掉）', () => {
  for (const visitor of D00_RUN.visitors) {
    const ev = evaluateVisitor(
      {
        ipRegion: visitor.ipRegion,
        timezone: visitor.timezone,
        language: visitor.language,
        accountRegion: visitor.accountRegion,
        facts: visitor.facts,
      },
      D00_RUN.events,
      visitor.index,
    );
    assert.notEqual(ev.verdict, 'AMBIGUOUS', visitor.code);
    assert.equal(ev.verdict, visitor.correct, `${visitor.code} 旧判定 ${visitor.correct} vs oracle ${ev.verdict}`);
  }
});

test('D00 沿用旧版三则广播（3/6/8），规则清单随之装配', () => {
  assert.deepEqual(D00_RUN.events.map((e) => e.index), [3, 6, 8]);
  assert.equal(D00_RUN.updates.length, 3);
  assert.ok(D00_RUN.rules.some((r) => r.code === 'R06'));
  assert.ok(D00_RUN.rules.some((r) => r.code === 'R07'));
});
