import { generateRunWithErrors } from '../src/game/generator.ts';
import { DAY_IDS } from '../src/data/levels.ts';

for (const day of DAY_IDS) {
  let ok = 0; const fails = new Map<string, number>();
  for (let s = 0; s < 60; s += 1) {
    const r = generateRunWithErrors(day, 1000 + s);
    if (r.run) ok += 1;
    else { const k = r.errors.join(' | '); fails.set(k, (fails.get(k) ?? 0) + 1); }
  }
  console.log(day, 'ok', ok, '/60');
  for (const [k, n] of fails) console.log('   x' + n, k.slice(0, 300));
}
