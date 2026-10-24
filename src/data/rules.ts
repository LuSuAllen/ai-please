import type { GameEvent, Rule, RuleUpdate } from '../types/game';
import { REGION_MAP } from './regions.ts';

/** 审核规则正文（数据驱动，不在组件里硬编码）。生效时点由每局事件决定。 */
export const RULE_BASE: Rule[] = [
  { code: 'R01', title: 'OPEN ZONE', body: '申请人 IP 地区必须位于当日开放区注册表内。', since: 0, grade: 'hard' },
  { code: 'R02', title: 'TIME SYNC', body: '浏览器时区必须与 IP 地区标准时区完全一致（偏差 0 小时）。', since: 0, grade: 'hard' },
  { code: 'R03', title: 'ACCOUNT LINK', body: '账号注册地区必须与 IP 地区一致。', since: 0, grade: 'hard' },
  { code: 'R04', title: 'LANGUAGE', body: '浏览器语言必须与账号地区的注册语言一致。', since: 0, grade: 'hard' },
  { code: 'R05', title: 'INTENT', body: '访问理由必须与申请服务的用途一致。', since: 0, grade: 'hard' },
  {
    code: 'R06',
    title: 'INTEGRITY',
    body: '设备指纹命中黑名单，或账号注册时间晚于申请提交时间，一律拒绝。',
    since: 3,
    grade: 'hard',
  },
  {
    code: 'R07',
    title: 'EMERGENCY ORDER',
    body: 'BX-12 边境中立区申请豁免 R01（开放区检查）。与 R01 冲突时，以本条为准；其余规则照常审核。',
    since: 8,
    grade: 'hard',
  },
];

/** 本局规则：R01–R05 开局生效，R06/R07 随 ruleIntro 事件生效；未出现的规则不列出。 */
export function rulesForEvents(events: readonly GameEvent[]): Rule[] {
  const out: Rule[] = [];
  for (const rule of RULE_BASE) {
    if (rule.code === 'R06' || rule.code === 'R07') {
      const ev = events.find((e) => e.kind === 'ruleIntro' && e.code === rule.code);
      if (ev) out.push({ ...rule, since: ev.index });
    } else {
      out.push({ ...rule, since: 0 });
    }
  }
  return out;
}

/** 将事件转为需要玩家确认的广播 */
export function updateForEvent(event: GameEvent): RuleUpdate {
  if (event.kind === 'ruleIntro' && event.code === 'R06') {
    return {
      atIndex: event.index,
      headline: 'R06 已上线 · INTEGRITY',
      detail: '设备黑名单与时间戳倒挂检查生效。对「看着没问题」的申请，请执行 INSPECT。',
    };
  }
  if (event.kind === 'ruleIntro') {
    return {
      atIndex: event.index,
      headline: 'R07 紧急豁免令签发',
      detail: 'BX-12 边境中立区申请豁免 R01 开放区检查。与 R01 冲突时以 R07 为准，其余规则照常审核。',
    };
  }
  if (event.kind === 'zoneChange') {
    const names = (codes: string[]) => codes.map((c) => `${c} ${REGION_MAP[c]?.name ?? ''}`.trim()).join('、');
    const parts: string[] = [];
    if (event.closes.length) parts.push(`${names(event.closes)} · 移出开放区。`);
    if (event.opens.length) parts.push(`${names(event.opens)} · 加入开放区。`);
    return { atIndex: event.index, headline: '开放区名单变更', detail: parts.join('') };
  }
  return {
    atIndex: event.index,
    headline: '特赦令生效 · R01 暂缓',
    detail: `接下来 ${event.length} 位访客，R01 开放区检查暂缓执行；其余规则照常。`,
  };
}
