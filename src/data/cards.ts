import type { BuildCtx, TemplateDef } from './templates.ts';
import { closedRegionsOf, compliantDraft, openRegionsOf } from './templates.ts';
import { REGION_MAP } from './regions.ts';
import { amnestyActiveAt, ruleActiveAt } from '../game/zones.ts';

/**
 * 手工卡：特殊（S）与冲突（C）。仍然只描述字段，correct 由 oracle 算出；
 * check() 断言卡片应当制造的"冲突结构"，防止模板被改坏。
 */

const r06On = (ctx: BuildCtx) => ruleActiveAt(ctx.events, 'R06', ctx.index);
const r07On = (ctx: BuildCtx) => ruleActiveAt(ctx.events, 'R07', ctx.index);

/** R07 生效时 BX-12 由冲突卡单独承载，普通"关闭区"不含它 */
function plainClosed(ctx: BuildCtx) {
  return closedRegionsOf(ctx, true);
}

export const CARDS: TemplateDef[] = [
  {
    id: 'S-MAINT-UND',
    group: 'S',
    tier: 'special',
    eligible: (ctx) => openRegionsOf(ctx).length > 0,
    build: (ctx) => {
      const d = compliantDraft(ctx, ctx.rng.pick(openRegionsOf(ctx)).code);
      d.language = '';
      d.facts.langMaintenance = true;
      d.signals = [{ code: 'LANG_EMPTY', label: '浏览器语言字段为空', level: 'warn' }];
      d.hiddenClues = [`区服维护导致语言字段为空，同批 ${200 + ctx.rng.int(60)} 份申请出现同样现象。`];
      return d;
    },
    check: (ev) =>
      ev.verdict === 'APPROVE' &&
      ev.requiresInspect &&
      ev.findings.some((f) => f.kind === 'exemption' && f.ruleCode === 'MAINT'),
  },
  {
    id: 'S-AMNESTY',
    group: 'S',
    tier: 'special',
    eligible: (ctx) => amnestyActiveAt(ctx.events, ctx.index) && plainClosed(ctx).length > 0,
    build: (ctx) => {
      const region = ctx.rng.pick(plainClosed(ctx));
      const d = compliantDraft(ctx, region.code);
      d.signals = [{ code: 'ZONE_CHECK', label: `${region.code} 不在今日开放区名单内`, level: 'warn' }];
      d.hiddenClues = [`网关日志：该 IP 近 24 小时仅出现在 ${region.code}。`];
      return d;
    },
    check: (ev) =>
      ev.verdict === 'APPROVE' &&
      !ev.requiresInspect &&
      ev.findings.some((f) => f.kind === 'exemption' && f.ruleCode === 'AMNESTY'),
  },
  {
    id: 'S-FALSE-POSITIVE',
    group: 'S',
    tier: 'special',
    eligible: (ctx) => r06On(ctx) && openRegionsOf(ctx).length > 0,
    build: (ctx) => {
      const d = compliantDraft(ctx, ctx.rng.pick(openRegionsOf(ctx)).code);
      const bl = 10 + ctx.rng.int(80);
      d.signals = [{ code: 'DEVICE_UNVERIFIED', label: '设备指纹与黑名单条目相似，需调取档案', level: 'warn' }];
      d.hiddenClues = [`相似条目 BL-${bl} 已于今日撤销，该设备当前不在黑名单内。`];
      return d;
    },
    check: (ev) => ev.verdict === 'APPROVE' && !ev.requiresInspect && ev.findings.length === 0,
  },
  {
    id: 'C-OVERRIDE',
    group: 'C',
    tier: 'conflict',
    eligible: (ctx) => r07On(ctx) && !openRegionsOf(ctx).some((r) => r.code === 'BX-12'),
    build: (ctx) => {
      const d = compliantDraft(ctx, 'BX-12');
      d.signals = [{ code: 'ZONE_CHECK', label: 'BX-12 不在今日开放区名单内，申请附豁免编号', level: 'warn' }];
      d.hiddenClues = [`申请附带豁免编号 EX-07-${100 + ctx.rng.int(900)}，签发状态有效。`];
      return d;
    },
    check: (ev) =>
      ev.verdict === 'APPROVE' &&
      ev.findings.some((f) => f.kind === 'exemption' && f.ruleCode === 'R07'),
  },
  {
    id: 'C-AMNESTY-BLOCKED',
    group: 'C',
    tier: 'conflict',
    eligible: (ctx) => r06On(ctx) && amnestyActiveAt(ctx.events, ctx.index) && plainClosed(ctx).length > 0,
    build: (ctx) => {
      const region = ctx.rng.pick(plainClosed(ctx));
      const d = compliantDraft(ctx, region.code);
      d.facts.blacklisted = true;
      d.signals = [
        { code: 'ZONE_CHECK', label: `${region.code} 不在今日开放区名单内`, level: 'warn' },
        { code: 'DEVICE_UNVERIFIED', label: '设备指纹本地校验未完成，需调取档案', level: 'warn' },
      ];
      d.hiddenClues = [`该地区处于特赦窗口；设备指纹命中黑名单条目 BL-${10 + ctx.rng.int(80)}。`];
      return d;
    },
    check: (ev) => ev.verdict === 'DENY' && ev.deciding === 'R06' && ev.requiresInspect,
  },
  {
    id: 'C-EXEMPT-EXPIRED',
    group: 'C',
    tier: 'conflict',
    eligible: (ctx) => r07On(ctx) && !openRegionsOf(ctx).some((r) => r.code === 'BX-12'),
    build: (ctx) => {
      const d = compliantDraft(ctx, 'BX-12');
      const other = ctx.rng.pick(
        Object.values(REGION_MAP).filter((r) => r.timezone !== REGION_MAP['BX-12'].timezone),
      );
      d.timezone = other.timezone;
      d.signals = [
        { code: 'ZONE_CHECK', label: 'BX-12 不在今日开放区名单内，申请附豁免编号', level: 'warn' },
        { code: 'TIME_OFFSET', label: `浏览器时区 ${other.timezone} 与 IP 地区标准时区不一致`, level: 'alert' },
      ];
      d.hiddenClues = [`豁免编号 EX-07-${100 + ctx.rng.int(900)} 有效，但仅覆盖开放区检查。`];
      return d;
    },
    check: (ev) =>
      ev.verdict === 'DENY' &&
      ev.deciding === 'R02' &&
      !ev.requiresInspect &&
      ev.findings.some((f) => f.kind === 'exemption' && f.ruleCode === 'R07'),
  },
];
