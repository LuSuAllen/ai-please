/**
 * 行为快照：对固定 (day, seed) 集合吐出整局"可判定事实"的哈希。
 * 用途：做重构/减法时证明玩法一字未改 —— 快照 diff 为空才算"没动核心玩法"。
 * 用法：node --experimental-strip-types scripts/snapshot-runs.mts [outFile]
 */
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { generateRun } from '../src/game/generator.ts';
import { DAY_IDS, LEGACY_DAY_IDS } from '../src/data/levels.ts';

const OUT = process.argv[2] ?? '/tmp/ai-please-snapshot.json';
const SEEDS = Array.from({ length: 24 }, (_, i) => 1000 + i * 37);

const LEGACY = new Set<string>(LEGACY_DAY_IDS);
const snapshots: Record<string, string> = {};
/** 冻结区（D01–D03）与配方区（D04+）分开汇总：加新关不得让冻结区的哈希变化 */
const legacy: Record<string, string> = {};
const composed: Record<string, string> = {};
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

for (const day of DAY_IDS) {
  const bucket = LEGACY.has(day) ? legacy : composed;
  for (const seed of SEEDS) {
    const run = generateRun(day, seed);
    if (!run) throw new Error(`generate failed ${day}/${seed}`);
    const facts = run.visitors.map((v) => [
      v.id, v.code, v.templateId, v.fingerprint, v.correct, v.requiresInspect,
      v.name, v.alias, v.avatarSeed, v.ipRegion, v.timezone, v.language,
      v.accountRegion, v.serviceId, v.reason, v.device, v.submittedAt,
      v.explanation, v.ruleRefs.join('+'), v.signals.map((s) => `${s.code}:${s.level}`).join('+'),
      v.hiddenClues.join('|'), JSON.stringify(v.facts),
    ].join('\u0001'));
    const payload = JSON.stringify({
      day: run.day,
      total: run.total,
      visitors: facts,
      rules: run.rules.map((r) => `${r.code}:${r.since}:${r.title}`),
      updates: run.updates.map((u) => `${u.atIndex}:${u.headline}:${u.detail}`),
      events: JSON.stringify(run.events),
    });
    const digest = createHash('sha256').update(payload).digest('hex').slice(0, 16);
    snapshots[`${day}/${seed}`] = digest;
    bucket[`${day}/${seed}`] = digest;
  }
}
writeFileSync(OUT, JSON.stringify(snapshots, null, 2));
console.log(`snapshots=${Object.keys(snapshots).length} → ${OUT}`);
console.log(`legacy-combined=${sha(legacy)}   # D01–D03 冻结区，必须恒为 6ea6656d4ab9ad0e`);
console.log(`composed-combined=${sha(composed)}`);
console.log(`combined=${sha(snapshots)}   # 含新关，仅作变更提示，不作 pass/fail 判据`);
