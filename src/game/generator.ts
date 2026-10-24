import type { GeneratedRun, GameEvent, Signal, Visitor, VisitorFacts } from '../types/game.ts';
import type { Rng } from './rng.ts';
import { createRng, GEN_VERSION, hash32, masterSeed } from './rng.ts';
import type { BuildCtx, Draft, TemplateDef, TemplateGroup } from '../data/templates.ts';
import { clockOf, fmtClock, TEMPLATES } from '../data/templates.ts';
import { CARDS } from '../data/cards.ts';
import { getBlueprint } from '../data/levels.ts';
import { rulesForEvents, updateForEvent } from '../data/rules.ts';
import { BALANCE } from '../data/balance.ts';
import { evaluateVisitor, ruleRefsOf } from './rules-eval.ts';
import { validateRun } from './validate.ts';

/**
 * 阵容生成器：蓝图（人数/配额/事件/手工卡槽）→ 依次落位 → 物化字段 → oracle 判定 → 不变量校验。
 * 纯确定性：同一 (dayId, seed) 必得同一局；生成路径只用 seed 派生的子流。
 */

const ALL_TEMPLATES: TemplateDef[] = [...TEMPLATES, ...CARDS];
const BY_ID = new Map(ALL_TEMPLATES.map((t) => [t.id, t]));

const GIVEN: Array<[string, string]> = [
  ['米拉', 'MIRA'], ['昴', 'SUBARU'], ['伊莲娜', 'ELENA'], ['塔纳', 'THANA'],
  ['诺亚', 'NOAH'], ['梅芙', 'MEV'], ['萨米', 'SAMI'], ['德文', 'DEVON'],
  ['柚', 'YU'], ['奥托', 'OTTO'],
];

const FAMILY: Array<[string, string]> = [
  ['陈', 'CHEN'], ['卡托', 'KATO'], ['科斯塔', 'COSTA'], ['维拉', 'VIRA'],
  ['布莱克', 'BLACK'], ['阿尔坦', 'ARSLAN'], ['哈立德', 'KHALID'], ['罗斯', 'ROSS'],
  ['森田', 'MORITA'], ['布伦', 'BRENN'],
];

/** 姓名由「名 × 姓」组合而来：12×12=144 种，比摊开写名字表更省字节也更有变化 */
function pickName(rng: Rng): { name: string; alias: string } {
  const g = rng.pick(GIVEN);
  const f = rng.pick(FAMILY);
  return { name: `${g[0]} · ${f[0]}`, alias: `${g[1]} ${f[1]}` };
}

const DEVICE_KINDS = ['PHONE', 'LAPTOP', 'TAB', 'TERM'] as const;

const pad3 = (n: number) => String(n).padStart(3, '0');

function ctxFor(events: readonly GameEvent[], index: number, rng: Rng, allowCleanConfirm: boolean): BuildCtx {
  return { rng, index, events, allowCleanConfirm };
}

function groupCounts(blueprint: { quota: Record<TemplateGroup, number> }): Record<TemplateGroup, number> {
  return { ...blueprint.quota };
}

function buildVisitor(
  def: TemplateDef,
  index: number,
  rng: Rng,
  events: readonly GameEvent[],
  dayLabel: string,
  dayId: string,
  allowCleanConfirm: boolean,
): Visitor | null {
  const draft: Draft | null = def.build(ctxFor(events, index, rng, allowCleanConfirm));
  if (!draft) return null;
  const ev = evaluateVisitor(
    {
      ipRegion: draft.ipRegion,
      timezone: draft.timezone,
      language: draft.language,
      accountRegion: draft.accountRegion,
      facts: draft.facts,
    },
    events,
    index,
  );
  if (ev.verdict === 'AMBIGUOUS' || !def.check(ev)) return null;

  const parts = [
    'ai-please',
    `v${GEN_VERSION}`,
    dayLabel,
    String(index),
    def.id,
    draft.ipRegion,
    draft.timezone,
    draft.language,
    draft.accountRegion,
    draft.serviceId,
    draft.reason,
    draft.device ?? '',
  ];
  const fingerprint = `fp-${hash32(parts.join('|')).toString(16).padStart(8, '0')}`;

  return {
    id: `v${pad3(index + 1)}`,
    code: `V-${pad3(index + 1)}`,
    name: '',
    alias: '',
    avatarSeed: 0,
    tier: def.tier,
    ipRegion: draft.ipRegion,
    timezone: draft.timezone,
    language: draft.language,
    accountRegion: draft.accountRegion,
    serviceId: draft.serviceId,
    reason: draft.reason,
    device: draft.device ?? `${draft.ipRegion}-${rng.pick(DEVICE_KINDS)}-${1 + rng.int(9)}`,
    submittedAt: `${dayLabel} · ${fmtClock(clockOf(index))}`,
    signals: draft.signals as Signal[],
    hiddenClues: draft.hiddenClues,
    correct: ev.verdict,
    explanation: ev.reason,
    ruleRefs: ev.findings.length
      ? ruleRefsOf(ev)
      : rulesForEvents(events)
          .filter((r) => r.since <= index)
          .map((r) => r.code),
    templateId: def.id,
    day: dayId,
    index,
    requiresInspect: ev.requiresInspect,
    fingerprint,
    facts: draft.facts as VisitorFacts,
  };
}

/** 每个槽位可用的模板（按 index 与事件判定；I 组是否放开"干净确认"由外层决定） */
function eligibleFor(group: TemplateGroup, index: number, events: readonly GameEvent[], allowCleanConfirm: boolean, allowCleanInspect: boolean, rng: Rng): TemplateDef[] {
  return ALL_TEMPLATES.filter((t) => {
    if (t.group !== group) return false;
    if (t.id === 'I-CLEAN-CONFIRM' && !(allowCleanConfirm && allowCleanInspect)) return false;
    return t.eligible(ctxFor(events, index, rng, allowCleanConfirm));
  });
}

function assignGroups(
  blueprint: { visitorCount: number; quota: Record<TemplateGroup, number>; events: GameEvent[]; allowCleanConfirm: boolean },
  fixed: Array<string | null>,
  rng: Rng,
): Array<TemplateGroup | null> | null {
  const groups: Array<TemplateGroup | null> = fixed.map((id) => (id ? (BY_ID.get(id)?.group ?? null) : null));
  const remaining = groupCounts(blueprint);
  for (const g of groups) if (g) remaining[g] -= 1;
  for (const g of Object.keys(remaining) as TemplateGroup[]) if (remaining[g] < 0) return null;

  const free = groups.map((g, i) => (g === null ? i : -1)).filter((i) => i >= 0);
  const tokens: TemplateGroup[] = [];
  for (const g of Object.keys(remaining) as TemplateGroup[]) for (let k = 0; k < remaining[g]; k += 1) tokens.push(g);
  if (tokens.length !== free.length) return null;

  for (let attempt = 0; attempt < BALANCE.maxPlacementTries; attempt += 1) {
    const rngTry = rng.fork(`place:${attempt}`);
    const pool = rngTry.shuffle(tokens);
    const result = groups.slice();
    let ok = true;
    for (let i = 0; i < free.length; i += 1) {
      const index = free[i];
      const options = pool.filter((g) => {
        if (!eligibleFor(g, index, blueprint.events, blueprint.allowCleanConfirm, false, rngTry).length) return false;
        const prev = index > 0 ? result[index - 1] : null;
        // N 类只有 N-CLEAN 一种模板：相邻两个 N 必然生成同模板访客，排布阶段就拆开
        if (prev === g && g === 'N') return false;
        if (prev === g && index > 1 && result[index - 2] === g) return false;
        const heavy = (x: TemplateGroup | null) => x === 'I' || x === 'S' || x === 'C';
        if (prev && heavy(prev) && heavy(g)) return false;
        if (index === 0 && !(g === 'N' || g === 'D')) return false;
        return true;
      });
      if (!options.length) {
        ok = false;
        break;
      }
      const pick = rngTry.pick(options);
      result[index] = pick;
      pool.splice(pool.indexOf(pick), 1);
    }
    if (ok) return result;
  }
  return null;
}

export function generateRun(dayId: string, seed: number): GeneratedRun | null {
  return generateRunWithErrors(dayId, seed).run;
}

/** 同 generateRun，但把最后一次失败的校验错误带出来（测试与调参用） */
export function generateRunWithErrors(
  dayId: string,
  seed: number,
  opts: { fallbacks?: number; retries?: number } = {},
): { run: GeneratedRun | null; errors: string[] } {
  if (!getBlueprint(dayId)) return { run: null, errors: ['未知关卡'] };
  const fallbacks = opts.fallbacks ?? BALANCE.maxSeedFallbacks;
  const retries = opts.retries ?? BALANCE.maxRunRetries;
  let errors: string[] = [];
  for (let fallback = 0; fallback <= fallbacks; fallback += 1) {
    const useSeed = (seed >>> 0) + fallback;
    const base = masterSeed(dayId, useSeed);
    for (let runTry = 0; runTry < retries; runTry += 1) {
      const result = tryGenerate(dayId, useSeed, base, runTry);
      if (result.run) return { run: result.run, errors: [] };
      errors = result.errors;
    }
  }
  return { run: null, errors };
}

function tryGenerate(dayId: string, seed: number, base: number, runTry: number): { run: GeneratedRun | null; errors: string[] } {
  const blueprint = getBlueprint(dayId);
  if (!blueprint) return { run: null, errors: ['未知关卡'] };
  const rng = createRng(base).fork(`run:${runTry}`);
  const total = blueprint.visitorCount;

  // 1) 手工卡槽
  const fixed: Array<string | null> = new Array(total).fill(null);
  for (const pool of blueprint.cardSlots) {
    const rngPool = rng.fork(`card:${pool.pool}`);
    const options = pool.candidates.filter((c) => {
      const def = BY_ID.get(c.cardId);
      if (!def || c.index < 0 || c.index >= total) return false;
      if (fixed[c.index] !== null) return false;
      return def.eligible(ctxFor(blueprint.events, c.index, rngPool, blueprint.allowCleanConfirm));
    });
    if (!options.length) return { run: null, errors: ['槽位排布或物化失败'] };
    const chosen = rngPool.pick(options);
    fixed[chosen.index] = chosen.cardId;
  }

  // 2) 剩余槽位分配类别
  const layout = assignGroups(blueprint, fixed, rng);
  if (!layout) return { run: null, errors: ['槽位排布或物化失败'] };

  // 3) 逐槽选定模板并物化访客
  const allowCleanInspect = fixed.some((id) => id === 'C-AMNESTY-BLOCKED');
  const usedTemplates: string[] = [];
  const usedFp = new Set<string>();
  const usedAvatar = new Set<number>();
  const visitors: Visitor[] = [];

  for (let index = 0; index < total; index += 1) {
    const fixedId = fixed[index];
    const group = layout[index];
    if (!fixedId && !group) return { run: null, errors: ['槽位排布或物化失败'] };
    const candidates = fixedId
      ? [BY_ID.get(fixedId)].filter((x): x is TemplateDef => Boolean(x))
      : eligibleFor(group as TemplateGroup, index, blueprint.events, blueprint.allowCleanConfirm, allowCleanInspect, rng.fork(`pick:${index}`));
    if (!candidates.length) return { run: null, errors: ['槽位排布或物化失败'] };

    let visitor: Visitor | null = null;
    for (let k = 0; k < BALANCE.maxSlotRetries && !visitor; k += 1) {
      const rngSlot = rng.fork(`slot:${index}:${k}`).fork(`try:${index * 97 + k}`);
      const recent = usedTemplates.slice(-6);
      const fresh = candidates.filter((t) => !recent.includes(t.id));
      // 相邻两位不重复同模板：N 类只有 N-CLEAN 一种，6 格窗口必然撞车，这里兜底保证"不像复制粘贴"
      const nonAdjacent = candidates.filter((t) => t.id !== usedTemplates[usedTemplates.length - 1]);
      const pool = fresh.length ? fresh : nonAdjacent.length ? nonAdjacent : candidates;
      const zoneEvent = blueprint.events.find((e) => e.kind === 'zoneChange');
      const preferZone =
        (group as TemplateGroup | null) === 'A' &&
        zoneEvent !== undefined &&
        index >= zoneEvent.index &&
        !usedTemplates.includes('A-ZONE');
      const def = preferZone && pool.some((t) => t.id === 'A-ZONE') ? (BY_ID.get('A-ZONE') as TemplateDef) : rngSlot.pick(pool);
      const attempt = buildVisitor(def, index, rngSlot, blueprint.events, blueprint.label, blueprint.id, blueprint.allowCleanConfirm);
      if (!attempt) continue;
      // 同 IP 地区 / 同服务不连续出现：连续两关气质一样，玩家会觉得是复制
      const prev = visitors[visitors.length - 1];
      const lastTry = k === BALANCE.maxSlotRetries - 1;
      if (prev && !lastTry && (attempt.ipRegion === prev.ipRegion || attempt.serviceId === prev.serviceId)) continue;
      if (usedFp.has(attempt.fingerprint)) continue;
      let avatar = hash32(`avatar|${attempt.fingerprint}`) % 1000;
      let guard = 0;
      while (usedAvatar.has(avatar) && guard < 1000) {
        avatar = (avatar + 1) % 1000;
        guard += 1;
      }
      if (usedAvatar.has(avatar)) continue;
      // 姓名池按槽位子流抽取，保证同种子稳定
      const rngName = rng.fork(`name:${index}`);
      let chosenName = pickName(rngName);
      for (let guard = 0; guard < 24 && visitors.some((v) => v.name === chosenName.name); guard += 1) {
        chosenName = pickName(rngName);
      }
      usedAvatar.add(avatar);
      usedFp.add(attempt.fingerprint);
      usedTemplates.push(def.id);
      visitor = { ...attempt, name: chosenName.name, alias: chosenName.alias, avatarSeed: avatar };
    }
    if (!visitor) return { run: null, errors: ['槽位排布或物化失败'] };
    visitors.push(visitor);
  }

  const updates = blueprint.events
    .map((e) => updateForEvent(e))
    .sort((a, b) => a.atIndex - b.atIndex);

  const run: GeneratedRun = {
    seed,
    genVersion: GEN_VERSION,
    day: dayId,
    total,
    visitors,
    rules: rulesForEvents(blueprint.events),
    updates,
    events: blueprint.events,
  };

  const errors = validateRun(run, blueprint);
  return errors.length ? { run: null, errors } : { run, errors: [] };
}
