import type { DayBlueprint, GeneratedRun, Visitor } from '../types/game.ts';
import { BALANCE, FORBIDDEN_WORDS } from '../data/balance.ts';
import { TEMPLATES } from '../data/templates.ts';
import { CARDS } from '../data/cards.ts';
import { evaluateVisitor } from './rules-eval.ts';

/**
 * 生成期不变量（I1–I12）。任何一条不过 → 整局重试，绝不"放宽校验器"。
 * 返回人类可读的错误列表；空数组 = 通过。
 */

const ALL = new Map([...TEMPLATES, ...CARDS].map((t) => [t.id, t]));

const KNOWN_RULE = /^(R0[1-7]|R1\d|AMNESTY|MAINT)$/;

function visibleText(v: Visitor): string[] {
  return [v.reason, v.device, v.submittedAt, ...v.signals.map((s) => s.label), ...v.hiddenClues];
}

export function validateRun(run: GeneratedRun, blueprint?: DayBlueprint): string[] {
  const errors: string[] = [];
  const visitors = run.visitors;

  // I1 结构
  if (!Array.isArray(visitors) || visitors.length !== run.total) errors.push('I1 人数与 total 不一致');
  if (blueprint && blueprint.visitorCount !== run.total) errors.push('I1 total 与蓝图人数不一致');
  if (run.day !== (blueprint?.id ?? run.day)) errors.push('I1 day 与蓝图 id 不一致');

  // I2 索引 / 唯一性
  const ids = new Set<string>();
  const codes = new Set<string>();
  const fps = new Set<string>();
  const avatars = new Set<number>();
  visitors.forEach((v, i) => {
    if (v.index !== i) errors.push(`I2 ${v.code} index 应为 ${i}`);
    if (ids.has(v.id)) errors.push(`I2 重复 id ${v.id}`);
    if (codes.has(v.code)) errors.push(`I2 重复 code ${v.code}`);
    if (fps.has(v.fingerprint)) errors.push(`I2 重复指纹 ${v.fingerprint}`);
    if (avatars.has(v.avatarSeed)) errors.push(`I2 重复头像种子 ${v.avatarSeed}`);
    ids.add(v.id);
    codes.add(v.code);
    fps.add(v.fingerprint);
    avatars.add(v.avatarSeed);
  });

  // I3 oracle 复算一致（同一份源码，永远可复现）
  for (const v of visitors) {
    const ev = evaluateVisitor(
      { ipRegion: v.ipRegion, timezone: v.timezone, language: v.language, accountRegion: v.accountRegion, facts: v.facts },
      run.events,
      v.index,
    );
    if (ev.verdict === 'AMBIGUOUS') errors.push(`I3 ${v.code} 判定歧义`);
    else if (ev.verdict !== v.correct) errors.push(`I3 ${v.code} 正确答案与 oracle 不一致`);
    if (ev.requiresInspect !== v.requiresInspect) errors.push(`I3 ${v.code} requiresInspect 与 oracle 不一致`);
  }

  // I4 配额
  if (blueprint) {
    for (const [group, need] of Object.entries(blueprint.quota)) {
      const got = visitors.filter((v) => ALL.get(v.templateId)?.group === group).length;
      if (got !== need) errors.push(`I4 ${group} 配额 ${got}/${need}`);
    }
  }

  // I5 需要开档的访客必须带 warn/alert 提示
  for (const v of visitors) {
    if (v.requiresInspect && !v.signals.some((s) => s.level === 'warn' || s.level === 'alert')) {
      errors.push(`I5 ${v.code} 需要开档但没有任何提示信号`);
    }
  }

  // I6 判定前可见文本不得出现结论词
  for (const v of visitors) {
    for (const text of visibleText(v)) {
      for (const word of FORBIDDEN_WORDS) {
        if (text.includes(word)) errors.push(`I6 ${v.code} 可见文本含禁词「${word}」`);
      }
    }
  }

  // I7 规则触发后必须真的被"考到"
  const r06 = run.events.find((e) => e.kind === 'ruleIntro' && e.code === 'R06');
  if (r06) {
    const exercised = visitors.some((v) => v.index >= r06.index && v.requiresInspect && v.ruleRefs.includes('R06'));
    if (!exercised) errors.push('I7 R06 生效后没有被开档题考到');
  }
  const zoneChange = run.events.find((e) => e.kind === 'zoneChange');
  if (zoneChange) {
    const exercised = visitors.some(
      (v) =>
        v.index >= zoneChange.index &&
        (v.ruleRefs.includes('R01') || v.ruleRefs.includes('R07') || v.requiresInspect),
    );
    if (!exercised) errors.push('I8 开放区变更后没有被考到');
  }

  // I9 规则编号合法
  for (const v of visitors) {
    for (const code of v.ruleRefs) if (!KNOWN_RULE.test(code)) errors.push(`I9 ${v.code} 规则编号非法 ${code}`);
  }

  // I10 APPROVE 占比
  const approve = visitors.filter((v) => v.correct === 'APPROVE').length;
  const ratio = visitors.length ? approve / visitors.length : 0;
  if (ratio < BALANCE.approveMin || ratio > BALANCE.approveMax) {
    errors.push(`I10 APPROVE 占比 ${ratio.toFixed(3)} 越界`);
  }

  // I11 提交时间格式与递增
  let lastClock = -1;
  for (const v of visitors) {
    const m = /^DAY \d{2} · (\d{2}):(\d{2})$/.exec(v.submittedAt);
    if (!m) {
      errors.push(`I11 ${v.code} submittedAt 格式非法`);
      continue;
    }
    const clock = Number(m[1]) * 60 + Number(m[2]);
    if (clock <= lastClock) errors.push(`I11 ${v.code} submittedAt 未严格递增`);
    lastClock = clock;
  }

  // I12 规则列表与事件一致
  const hasR06 = Boolean(r06);
  const hasR07 = run.events.some((e) => e.kind === 'ruleIntro' && e.code === 'R07');
  if (run.rules.some((r) => r.code === 'R06') !== hasR06) errors.push('I12 R06 规则列表与事件不一致');
  if (run.rules.some((r) => r.code === 'R07') !== hasR07) errors.push('I12 R07 规则列表与事件不一致');
  for (let i = 1; i < run.updates.length; i += 1) {
    if (run.updates[i].atIndex < run.updates[i - 1].atIndex) errors.push('I12 广播未按索引排序');
  }

  return errors;
}
