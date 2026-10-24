/** 生成与平衡常量（集中管理，便于调参）。 */
export const BALANCE = {
  /** 每位访客提交间隔（分钟）与首位时间（09:00） */
  startMinutes: 9 * 60,
  minutesPerSlot: 7,
  /** APPROVE 占比允许范围 */
  approveMin: 0.45,
  approveMax: 0.68,
  /** 单槽位重试 / 整局重试上限 */
  maxSlotRetries: 8,
  maxRunRetries: 4,
  /** 邻近种子兜底次数 */
  maxSeedFallbacks: 3,
  /** 排布洗牌尝试次数 */
  maxPlacementTries: 40,
  /** 难度权重 */
  weights: { N: 0.2, D: 0.6, A: 1.0, I: 1.5, S: 2.0, C: 2.5 },
} as const;

/** 判定前玩家可见文本里禁止出现的结论词 */
export const FORBIDDEN_WORDS = ['放行', '拒绝', '驳回', '通过', '应批', 'APPROVE', 'DENY', '正确', '错误'] as const;

/** 开档额度：ceil(局人数 / 4) */
export function inspectQuota(total: number): number {
  return Math.ceil(total / 4);
}
