import type { GameEvent, Signal, VisitorFacts, VisitorTier } from '../types/game.ts';
import type { Rng } from '../game/rng.ts';
import type { Evaluation } from '../game/rules-eval.ts';
import { tzDiffHours } from '../game/rules-eval.ts';
import { isRegionOpen, ruleActiveAt, amnestyActiveAt } from '../game/zones.ts';
import { REGIONS, REGION_MAP, SERVICES } from './regions.ts';
import { BALANCE } from './balance.ts';

/**
 * 访客模板：只描述"字段如何物化"，不写 correct。
 * 正确答案由 src/game/rules-eval.ts 的 oracle 在生成期算出；check() 只断言"这个模板应当产生的结构"。
 */
export interface Draft {
  ipRegion: string;
  timezone: string;
  language: string;
  accountRegion: string;
  serviceId: string;
  reason: string;
  signals: Signal[];
  hiddenClues: string[];
  facts: VisitorFacts;
  device?: string;
}

export interface BuildCtx {
  rng: Rng;
  index: number;
  events: readonly GameEvent[];
  allowCleanConfirm: boolean;
}

export type TemplateGroup = 'N' | 'D' | 'A' | 'I' | 'S' | 'C';

export interface TemplateDef {
  id: string;
  group: TemplateGroup;
  tier: VisitorTier;
  eligible(ctx: BuildCtx): boolean;
  build(ctx: BuildCtx): Draft | null;
  check(ev: Evaluation): boolean;
}

export const CLEAN_FACTS: VisitorFacts = {
  intentMatch: true,
  blacklisted: false,
  registeredLate: false,
  langMaintenance: false,
};

export function clockOf(index: number): number {
  return BALANCE.startMinutes + BALANCE.minutesPerSlot * index;
}

export function fmtClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const MATCH_REASONS: Record<string, string[]> = {
  'gpt-nova': ['需要对话推理协助校对剧本对白。', '想让它帮忙梳理一周的会议纪要。'],
  'claude-orbit': ['需要长文本分析协助通读一份 80 页的租赁合同。', '想用长文本分析归纳年度调研报告。'],
  'gemini-drift': ['需要多模态检索定位一张老照片的拍摄地点。', '想按手绘草图检索相似的建筑图纸。'],
  'muse-x': ['需要图像生成为社区活动绘制海报底图。', '想生成一组像素风角色立绘。'],
  'codex-dune': ['需要代码补全协助修复一个分页组件。', '想让它补全一段数据清洗脚本。'],
};

const MISMATCH_REASONS: Record<string, string[]> = {
  'gpt-nova': ['想用它批量生成 200 张商品海报。', '想用它对一段视频做逐帧画面检索。'],
  'claude-orbit': ['想用它生成一组游戏角色立绘。', '想用它补全一段前端按钮的样式代码。'],
  'gemini-drift': ['想用它通宵写一段排序算法。', '想用它为客户生成宣传画。'],
  'muse-x': ['想用它通读并总结一份合同全文。', '想用它调试一个崩溃的后端服务。'],
  'codex-dune': ['想用它画一张奇幻地图插画。', '想用它翻译并归纳一篇长篇小说。'],
};

export function pickService(rng: Rng): string {
  return rng.pick(SERVICES).id;
}

export function matchReason(rng: Rng, serviceId: string): string {
  return rng.pick(MATCH_REASONS[serviceId]);
}

export function mismatchReason(rng: Rng, serviceId: string): string {
  return rng.pick(MISMATCH_REASONS[serviceId]);
}

export function tenureClue(rng: Rng): string {
  return `账号注册 ${1 + rng.int(6)} 年 ${rng.int(12)} 个月，历史申请 ${rng.int(3)} 次需补充材料。`;
}

export function openRegionsOf(ctx: BuildCtx) {
  return REGIONS.filter((r) => isRegionOpen(ctx.events, r.code, ctx.index));
}

/** 当前未开放的地区；R07 生效后 BX-12 不再算"未开放且违规"，由冲突卡单独使用 */
export function closedRegionsOf(ctx: BuildCtx, excludeExempt: boolean) {
  const r07 = ruleActiveAt(ctx.events, 'R07', ctx.index);
  return REGIONS.filter(
    (r) => !isRegionOpen(ctx.events, r.code, ctx.index) && !(excludeExempt && r07 && r.code === 'BX-12'),
  );
}

/** 全部合规的基础草稿 */
export function compliantDraft(ctx: BuildCtx, regionCode: string): Draft {
  const region = REGION_MAP[regionCode];
  const serviceId = pickService(ctx.rng);
  return {
    ipRegion: region.code,
    timezone: region.timezone,
    language: region.language,
    accountRegion: region.code,
    serviceId,
    reason: matchReason(ctx.rng, serviceId),
    signals: [],
    hiddenClues: [tenureClue(ctx.rng)],
    facts: { ...CLEAN_FACTS },
  };
}

function pickOpen(ctx: BuildCtx): string {
  return ctx.rng.pick(openRegionsOf(ctx)).code;
}

const noViolation = (ev: Evaluation) => ev.verdict === 'APPROVE' && ev.findings.length === 0;
const DEVICE_HINT = '设备指纹本地校验未完成，需调取档案';

const always = () => true;
const r06On = (ctx: BuildCtx) => ruleActiveAt(ctx.events, 'R06', ctx.index);

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'N-CLEAN',
    group: 'N',
    tier: 'normal',
    eligible: always,
    build: (ctx) => compliantDraft(ctx, pickOpen(ctx)),
    check: noViolation,
  },
  {
    id: 'D-TZ-ODD',
    group: 'D',
    tier: 'normal',
    eligible: (ctx) => isRegionOpen(ctx.events, 'HM-08', ctx.index),
    build: (ctx) => {
      const d = compliantDraft(ctx, 'HM-08');
      d.hiddenClues = ['时区为非整点偏移 UTC+05:30，与 IP 地区标准时区完全一致。'];
      return d;
    },
    check: noViolation,
  },
  {
    id: 'D-LANG-SUBTAG',
    group: 'D',
    tier: 'normal',
    eligible: (ctx) => isRegionOpen(ctx.events, 'VM-02', ctx.index),
    build: (ctx) => {
      const d = compliantDraft(ctx, 'VM-02');
      d.hiddenClues = ['浏览器语言 en-US 与 VM-02 注册语言 en-US 完全一致（BX-12 使用 en-GB）。'];
      return d;
    },
    check: noViolation,
  },
  {
    id: 'D-DEVICE-LOOKALIKE',
    group: 'D',
    tier: 'normal',
    eligible: r06On,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.hiddenClues = [`设备指纹与黑名单条目 BL-${10 + ctx.rng.int(80)} 仅末位不同，经比对未命中。`];
      return d;
    },
    check: noViolation,
  },
  {
    id: 'D-REASON-VERBOSE',
    group: 'D',
    tier: 'normal',
    eligible: always,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.reason = `${d.reason}该申请会分多次提交，每次一页以内。`;
      return d;
    },
    check: noViolation,
  },
  {
    id: 'D-ACCOUNT-NEW',
    group: 'D',
    tier: 'normal',
    eligible: always,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.hiddenClues = ['账号注册于今日 08:12，早于本次提交时间。'];
      return d;
    },
    check: noViolation,
  },
  {
    id: 'A-ZONE',
    group: 'A',
    tier: 'anomaly',
    eligible: (ctx) => !amnestyActiveAt(ctx.events, ctx.index) && closedRegionsOf(ctx, true).length > 0,
    build: (ctx) => {
      const region = ctx.rng.pick(closedRegionsOf(ctx, true));
      const d = compliantDraft(ctx, region.code);
      d.signals = [{ code: 'ZONE_CHECK', label: `${region.code} 不在今日开放区名单内`, level: 'alert' }];
      d.hiddenClues = [`网关日志：该 IP 近 24 小时仅出现在 ${region.code}。`];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R01' && !ev.requiresInspect,
  },
  {
    id: 'A-TZ',
    group: 'A',
    tier: 'anomaly',
    eligible: always,
    build: (ctx) => {
      const region = REGION_MAP[pickOpen(ctx)];
      const others = REGIONS.filter((r) => r.timezone !== region.timezone);
      const tz = ctx.rng.pick(others).timezone;
      const d = compliantDraft(ctx, region.code);
      d.timezone = tz;
      d.signals = [
        {
          code: 'TIME_OFFSET',
          label: `浏览器时区 ${tz} 与 IP 地区标准时区相差 ${tzDiffHours(tz, region.timezone)} 小时`,
          level: 'alert',
        },
      ];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R02' && !ev.requiresInspect,
  },
  {
    id: 'A-ACCOUNT',
    group: 'A',
    tier: 'anomaly',
    eligible: always,
    build: (ctx) => {
      const ip = pickOpen(ctx);
      const acct = ctx.rng.pick(REGIONS.filter((r) => r.code !== ip));
      const d = compliantDraft(ctx, ip);
      d.accountRegion = acct.code;
      d.language = acct.language;
      d.signals = [{ code: 'ACCOUNT_MISMATCH', label: `账号注册地 ${acct.code} 与 IP 地区 ${ip} 不一致`, level: 'alert' }];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R03' && !ev.requiresInspect,
  },
  {
    id: 'A-LANG',
    group: 'A',
    tier: 'anomaly',
    eligible: always,
    build: (ctx) => {
      const region = REGION_MAP[pickOpen(ctx)];
      const lang = ctx.rng.pick(REGIONS.filter((r) => r.language !== region.language)).language;
      const d = compliantDraft(ctx, region.code);
      d.language = lang;
      d.signals = [{ code: 'LANG_MISMATCH', label: `浏览器语言 ${lang} 与账号地区注册语言不一致`, level: 'warn' }];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R04' && !ev.requiresInspect,
  },
  {
    id: 'A-INTENT',
    group: 'A',
    tier: 'anomaly',
    eligible: always,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.reason = mismatchReason(ctx.rng, d.serviceId);
      d.facts.intentMatch = false;
      d.signals = [{ code: 'INTENT_MISMATCH', label: '访问理由与所申请服务的用途存在偏差', level: 'warn' }];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R05' && !ev.requiresInspect,
  },
  {
    id: 'I-BLACKLIST',
    group: 'I',
    tier: 'inspect',
    eligible: r06On,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.facts.blacklisted = true;
      d.signals = [{ code: 'DEVICE_UNVERIFIED', label: DEVICE_HINT, level: 'warn' }];
      d.hiddenClues = [`设备指纹命中黑名单条目 BL-${10 + ctx.rng.int(80)}。`];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R06' && ev.requiresInspect,
  },
  {
    id: 'I-TIMESTAMP',
    group: 'I',
    tier: 'inspect',
    eligible: r06On,
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.facts.registeredLate = true;
      const submit = clockOf(ctx.index);
      d.signals = [{ code: 'SUBMIT_UNVERIFIED', label: '注册与提交时间戳需要核对', level: 'warn' }];
      d.hiddenClues = [`账号注册时间 ${fmtClock(submit + 1 + ctx.rng.int(3))} 晚于提交时间 ${fmtClock(submit)}。`];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R06' && ev.requiresInspect,
  },
  {
    id: 'I-CLEAN-CONFIRM',
    group: 'I',
    tier: 'inspect',
    eligible: (ctx) => ctx.allowCleanConfirm && r06On(ctx),
    build: (ctx) => {
      const d = compliantDraft(ctx, pickOpen(ctx));
      d.signals = [{ code: 'DEVICE_UNVERIFIED', label: DEVICE_HINT, level: 'warn' }];
      d.hiddenClues = ['设备指纹已在白名单登记，未命中黑名单。'];
      return d;
    },
    check: (ev) => ev.verdict === 'APPROVE' && !ev.requiresInspect,
  },
];
