/**
 * DOD 压力取证：10000 局（3 天轮流）全部过不变量校验（含 oracle 复算、禁词、配额、线索泄漏）。
 * 用法：node --experimental-strip-types scripts/stress-invariants.mts [runs]
 */
import { generateRunWithErrors } from '../src/game/generator.ts';
import { validateRun } from '../src/game/validate.ts';
import { DAY_IDS, getBlueprint } from '../src/data/levels.ts';
import { BALANCE } from '../src/data/balance.ts';

const RUNS = Number(process.argv[2] ?? 10000);
const blueprints = DAY_IDS.map((day) => {
  const bp = getBlueprint(day);
  if (!bp) throw new Error(`missing blueprint ${day}`);
  return { day, bp };
});

let failures = 0;
const samples: number[] = [];
const perDay = new Map(DAY_IDS.map((d) => [d, 0]));

for (let i = 0; i < RUNS; i += 1) {
  const { day, bp } = blueprints[i % blueprints.length];
  const started = performance.now();
  const { run, errors } = generateRunWithErrors(day, 10_000 + i);
  samples.push(performance.now() - started);
  perDay.set(day, (perDay.get(day) ?? 0) + 1);
  if (!run) {
    failures += 1;
    if (failures <= 5) console.log(`FAIL ${day}/${10_000 + i}: ${errors.join('; ')}`);
    continue;
  }
  const issues = validateRun(run, bp);
  if (issues.length > 0) {
    failures += 1;
    if (failures <= 5) console.log(`FAIL ${day}/${10_000 + i}: ${issues.slice(0, 3).join('; ')}`);
  }
}

samples.sort((a, b) => a - b);
const p95 = samples[Math.floor(samples.length * 0.95)];
const p99 = samples[Math.floor(samples.length * 0.99)];
console.log(`runs=${RUNS} failures=${failures} p50=${samples[Math.floor(RUNS / 2)].toFixed(2)}ms p95=${p95.toFixed(2)}ms p99=${p99.toFixed(2)}ms budget=${BALANCE.minutesPerSlot}min/slot`);
console.log(`perDay=${[...perDay.entries()].map(([d, n]) => `${d}:${n}`).join(' ')}`);
if (failures > 0) process.exitCode = 1;
