/**
 * 双语注释层（视图层专用）。
 *
 * 原则：英文是**契约**（DOM 里必须保留，验收脚本 clickText / includes / innerText 依赖它），
 * 中文是**理解层**（照顾英文与专业术语薄弱的玩家）。
 *
 * 这里只放纯展示映射，绝不进入 src/data / src/game：
 * 快照哈希、I6 禁词、20KB 存档三道门禁都盯着数据层。
 */
import type { Move, VisitorTier } from '../types/game';

/** 规则标题：与 src/data/rules.ts 的正文用词对齐（开放区 / 时区 / 账号 / 语言 / 用途 / 设备与时间 / 豁免） */
export const RULE_ZH: Record<string, string> = {
  R01: '开放区',
  R02: '时区同步',
  R03: '账号关联',
  R04: '语言一致',
  R05: '用途匹配',
  R06: '诚信核查',
  R07: '紧急豁免令',
};

/** 访客风险等级 */
export const TIER_ZH: Record<VisitorTier, string> = {
  normal: '常规',
  anomaly: '标记',
  inspect: '深查',
  special: '优先',
  conflict: '争议',
};

/** 三个判定动作 */
export const MOVE_ZH: Record<Move, string> = {
  APPROVE: '放行',
  DENY: '拒绝',
  INSPECT: '开档',
};

/** 判定结论：反馈层标题用中文主标，英文 `VERDICT ACCEPTED` 仍以 7px 副标留在 DOM（验收脚本站位） */
export const VERDICT_ZH = {
  correct: '判定正确',
  wrong: '判定错误',
} as const;

/** 印章主标：2 字行内替换 22px 拉丁大写，高度与其他字母同高，不增行 */
export const STAMP_ZH = {
  correct: '正确',
  wrong: '错误',
} as const;

/** 判错的两种错型——与结算页「误放行 / 误拒绝」同一词表，数值差异（−150 vs −100）靠它解释 */
export const WRONG_KIND_ZH = {
  approve: '误放行 · 应判拒绝',
  deny: '误拒绝 · 应判放行',
} as const;

/** 账目标签：与顶部状态栏同词（分数 / 预算），避免同一资源两种叫法 */
export const METRIC_ZH = {
  score: '分数',
  funds: '预算',
  inspect: '开档',
  net: '本单净额',
  account: '账户',
} as const;

/** 纯操作/状态词：验收脚本零命中，可整体汉化（英文锚点另在按钮的 .bi-en 里） */
export const UI_ZH = {
  close: '关闭',
  back: '返回窗口',
  expand: '展开',
  locked: '未解锁',
  unstamped: '未盖章',
} as const;
