import type { Rule, RuleUpdate } from '../types/game';

/** 当日审核规则（数据驱动，不在组件里硬编码） */
export const RULES: Rule[] = [
  {
    code: 'R01',
    title: 'OPEN ZONE',
    body: '申请人 IP 地区必须位于当日开放区注册表内。',
    since: 0,
    grade: 'hard',
  },
  {
    code: 'R02',
    title: 'TIME SYNC',
    body: '浏览器时区必须与 IP 地区标准时区完全一致（偏差 0 小时）。',
    since: 0,
    grade: 'hard',
  },
  {
    code: 'R03',
    title: 'ACCOUNT LINK',
    body: '账号注册地区必须与 IP 地区一致。',
    since: 0,
    grade: 'hard',
  },
  {
    code: 'R04',
    title: 'LANGUAGE',
    body: '浏览器语言必须与账号地区的注册语言一致。',
    since: 0,
    grade: 'hard',
  },
  {
    code: 'R05',
    title: 'INTENT',
    body: '访问理由必须与申请服务的用途一致。',
    since: 0,
    grade: 'hard',
  },
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
    body: 'BX-12 边境中立区申请一律放行（内部豁免令）。与 R01 冲突时，以本条为准。',
    since: 8,
    grade: 'hard',
  },
];

export const RULE_UPDATES: RuleUpdate[] = [
  {
    atIndex: 3,
    headline: 'R06 已上线 · INTEGRITY',
    detail: '设备黑名单与时间戳倒挂检查生效。对「看着没问题」的申请，请执行 INSPECT。',
  },
  {
    atIndex: 6,
    headline: '开放区名单变更',
    detail: 'TZ-07 赤道缓冲区 · 移出开放区。SG-03 沙丘区 · 加入开放区。',
  },
  {
    atIndex: 8,
    headline: 'R07 紧急豁免令签发',
    detail: 'BX-12 边境中立区申请一律放行。与 R01 冲突时以 R07 为准。',
  },
];

export function activeRules(index: number): Rule[] {
  return RULES.filter((r) => r.since <= index);
}
