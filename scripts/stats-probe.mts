import { generateRunWithErrors } from '../src/game/generator.ts';
import { DAY_IDS } from '../src/data/levels.ts';

const SEEDS = 400;
for (const day of DAY_IDS) {
  let approve = 0, total = 0, inspect = 0, inspMax = 0, minApp = 1, maxApp = 0;
  const tmpl = new Map<string, number>();
  let fail = 0;
  for (let s = 0; s < SEEDS; s += 1) {
    const r = generateRunWithErrors(day, 7000 + s);
    if (!r.run) { fail += 1; continue; }
    const run = r.run;
    const app = run.visitors.filter((v) => v.correct === 'APPROVE').length;
    approve += app; total += run.visitors.length;
    const insp = run.visitors.filter((v) => v.requiresInspect).length;
    inspect += insp; inspMax = Math.max(inspMax, insp);
    minApp = Math.min(minApp, app / run.visitors.length);
    maxApp = Math.max(maxApp, app / run.visitors.length);
    for (const v of run.visitors) tmpl.set(v.templateId, (tmpl.get(v.templateId) ?? 0) + 1);
  }
  console.log(`${day} fail=${fail} approve=${(approve / total).toFixed(3)} range=[${minApp.toFixed(2)},${maxApp.toFixed(2)}] inspectAvg=${(inspect / SEEDS).toFixed(2)} inspMax=${inspMax}`);
  console.log('   templates:', [...tmpl.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
}
