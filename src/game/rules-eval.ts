import type { GameEvent, Verdict, Visitor, VisitorFacts } from '../types/game';
import { REGION_MAP } from '../data/regions.ts';
import { amnestyActiveAt, isRegionOpen, ruleActiveAt } from './zones.ts';

/**
 * 规则求值器（oracle）：访客的正确答案只由它在生成期算出，模板不写 correct。
 * 纯函数，无随机、无时钟。
 */

export interface Finding {
  /** R01..R07，或 AMNESTY / MAINT */
  ruleCode: string;
  kind: 'violation' | 'exemption';
  note: string;
}

export interface Evaluation {
  verdict: Verdict | 'AMBIGUOUS';
  findings: Finding[];
  deciding: string | null;
  /** 只看可见字段得出的结论与最终结论不同 → 必须开档才能判对 */
  requiresInspect: boolean;
  reason: string;
}

export type EvalInput = Pick<Visitor, 'ipRegion' | 'timezone' | 'language' | 'accountRegion'> & {
  facts: VisitorFacts;
};

function offsetMinutes(tz: string): number {
  const m = /^UTC([+-])(\d{2}):(\d{2})$/.exec(tz);
  if (!m) return 0;
  const v = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -v : v;
}

export function tzDiffHours(a: string, b: string): number {
  return Math.abs(offsetMinutes(a) - offsetMinutes(b)) / 60;
}

const MASKED: Pick<VisitorFacts, 'blacklisted' | 'registeredLate' | 'langMaintenance'> = {
  blacklisted: false,
  registeredLate: false,
  langMaintenance: false,
};

function run(input: EvalInput, events: readonly GameEvent[], index: number) {
  const ip = REGION_MAP[input.ipRegion];
  const acct = REGION_MAP[input.accountRegion];
  if (!ip || !acct) return null;
  const f = input.facts;
  const findings: Finding[] = [];
  const residual: Finding[] = [];

  const add = (violation: Finding, exemptBy: Finding | null) => {
    findings.push(violation);
    if (exemptBy) findings.push(exemptBy);
    else residual.push(violation);
  };

  if (!isRegionOpen(events, input.ipRegion, index)) {
    const v: Finding = { ruleCode: 'R01', kind: 'violation', note: `${ip.code} 当前未列入开放区名单。` };
    if (ruleActiveAt(events, 'R07', index) && input.ipRegion === 'BX-12') {
      add(v, { ruleCode: 'R07', kind: 'exemption', note: 'R07 紧急豁免令覆盖 BX-12 的 R01 检查。' });
    } else if (amnestyActiveAt(events, index)) {
      add(v, { ruleCode: 'AMNESTY', kind: 'exemption', note: '特赦窗口内 R01 暂缓执行。' });
    } else {
      add(v, null);
    }
  }
  if (input.timezone !== ip.timezone) {
    add(
      {
        ruleCode: 'R02',
        kind: 'violation',
        note: `${ip.code} 标准时区为 ${ip.timezone}，申请人时区 ${input.timezone}，偏差 ${tzDiffHours(ip.timezone, input.timezone)} 小时。`,
      },
      null,
    );
  }
  if (input.accountRegion !== input.ipRegion) {
    add(
      { ruleCode: 'R03', kind: 'violation', note: `账号注册地 ${input.accountRegion} 与 IP 地区 ${input.ipRegion} 不一致。` },
      null,
    );
  }
  if (input.language !== acct.language) {
    const v: Finding = {
      ruleCode: 'R04',
      kind: 'violation',
      note: `浏览器语言 ${input.language} 与 ${acct.code} 注册语言 ${acct.language} 不一致。`,
    };
    add(v, f.langMaintenance ? { ruleCode: 'MAINT', kind: 'exemption', note: '区服维护日志证明语言字段被系统清空，非申请人行为。' } : null);
  }
  if (!f.intentMatch) {
    add({ ruleCode: 'R05', kind: 'violation', note: '访问理由与所申请服务的用途不一致。' }, null);
  }
  if (ruleActiveAt(events, 'R06', index)) {
    if (f.blacklisted) add({ ruleCode: 'R06', kind: 'violation', note: '设备指纹命中黑名单。' }, null);
    if (f.registeredLate) add({ ruleCode: 'R06', kind: 'violation', note: '账号注册时间晚于申请提交时间。' }, null);
  }
  return { findings, residual };
}

export function evaluateVisitor(input: EvalInput, events: readonly GameEvent[], index: number): Evaluation {
  const r = run(input, events, index);
  if (!r) {
    return { verdict: 'AMBIGUOUS', findings: [], deciding: null, requiresInspect: false, reason: '地区未登记，无法判定。' };
  }
  const verdict: Verdict = r.residual.length > 0 ? 'DENY' : 'APPROVE';
  const exemptions = r.findings.filter((x) => x.kind === 'exemption');
  const deciding = r.residual.length > 0 ? r.residual[0].ruleCode : exemptions.length > 0 ? exemptions[0].ruleCode : null;

  const masked = run({ ...input, facts: { ...input.facts, ...MASKED } }, events, index);
  const visibleVerdict: Verdict = masked && masked.residual.length > 0 ? 'DENY' : 'APPROVE';

  let reason: string;
  if (verdict === 'DENY') {
    reason = r.residual.map((x) => x.note).join('');
  } else if (exemptions.length > 0) {
    reason = exemptions.map((x) => x.note).join('');
  } else {
    reason = '全部适用规则均已满足。';
  }
  return { verdict, findings: r.findings, deciding, requiresInspect: visibleVerdict !== verdict, reason };
}

/** 需要写进 ruleRefs 的规则编号（去重，保持出现顺序，AMNESTY 记为 R01，MAINT 记为 R04） */
export function ruleRefsOf(ev: Evaluation): string[] {
  const out: string[] = [];
  for (const f of ev.findings) {
    const code = f.ruleCode === 'AMNESTY' ? 'R01' : f.ruleCode === 'MAINT' ? 'R04' : f.ruleCode;
    if (!out.includes(code)) out.push(code);
  }
  return out;
}
