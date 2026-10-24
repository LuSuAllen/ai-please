import type { Signal, Verdict, Visitor, VisitorFacts, VisitorTier } from '../../types/game.ts';

/**
 * 旧版（v2）固定阵容 D00 —— 冻结存档，只读。
 * v2 存档迁移时映射成 D00 一局，保证老玩家可以接着玩。
 * 数据全部虚构，不使用任何真实用户信息。
 *
 * 为了不进首屏预算，行用紧凑元组编码；展开后的字段值与旧版逐一相同（tests/legacy.d00）。
 * signal 编码为 "CODE~文案~级别"，多条用 | 连接。
 */
type Row = [
  name: string,
  alias: string,
  avatarSeed: number,
  tier: VisitorTier,
  ipRegion: string,
  timezone: string,
  language: string,
  accountRegion: string,
  serviceId: string,
  reason: string,
  device: string,
  submittedAt: string,
  signals: string,
  hiddenClues: string[],
  correct: Verdict,
  explanation: string,
  ruleRefs: string[],
];

const ROWS: Row[] = [
  [
    '米拉 · 陈', 'MIRA CHEN', 11, 'normal', 'KA-01', 'UTC+08:00', 'zh-CN', 'KA-01', 'gpt-nova',
    '需要对话推理协助校对剧本对白。', 'BX-PHONE-7', 'DAY 01 · 09:04', '',
    ['账号注册 3 年 2 个月，历史申请 0 次驳回。'],
    'APPROVE',
    'R01–R05 全部通过：开放区、时区、账号地区、语言、用途完全一致。',
    ['R01', 'R02', 'R03', 'R04', 'R05'],
  ],
  [
    '昴 · 卡托', 'SUBARU KATO', 23, 'anomaly', 'NA-04', 'UTC-03:00', 'ja-JP', 'NA-04', 'claude-orbit',
    '需要长文本分析协助整理采访记录。', 'NA-LAPTOP-2', 'DAY 01 · 09:12',
    'TIME_OFFSET~时区与 IP 地区相差 12 小时~alert',
    ['出口节点显示 3 跳中转，跳转路径未登记。'],
    'DENY',
    'NA-04 标准时区为 UTC+09:00，申请人时区 UTC-03:00 偏差 12 小时，违反 R02。',
    ['R02'],
  ],
  [
    '伊莲娜 · 科斯塔', 'ELENA COSTA', 5, 'anomaly', 'OR-09', 'UTC+01:00', 'de-DE', 'VM-02', 'muse-x',
    '需要图像生成协助完成海报草图。', 'OR-TAB-1', 'DAY 01 · 09:20',
    'ACCOUNT_MISMATCH~账号注册地区与 IP 地区不一致~alert',
    ['账号半年内变更注册地区 2 次。'],
    'DENY',
    '账号注册地为 VM-02 云母区，与 IP 地区 OR-09 东岸开发区不一致，违反 R03。',
    ['R03'],
  ],
  [
    '塔纳 · 维拉', 'THANA VIRA', 37, 'normal', 'TZ-07', 'UTC+07:00', 'th-TH', 'TZ-07', 'gemini-drift',
    '需要多模态检索协助核对影像素材。', 'TZ-HANDSET-9', 'DAY 01 · 09:31', '',
    ['语言标签 th-TH 与 TZ-07 注册语言一致。'],
    'APPROVE',
    'TZ-07 此刻仍在开放区，且时区、账号地区、语言、用途全部一致，R01–R05 通过。',
    ['R01', 'R02', 'R03', 'R04', 'R05'],
  ],
  [
    '诺亚 · 布莱克', 'NOAH BLACK', 42, 'inspect', 'VM-02', 'UTC-05:00', 'en-US', 'VM-02', 'codex-dune',
    '需要代码补全协助维护开源项目。', 'VM-DESK-4', 'DAY 01 · 09:44', '',
    ['设备指纹 VM-DESK-4 命中黑名单 BL-14（自动化并发申请）。', '同一设备 6 小时内提交 11 次申请。'],
    'DENY',
    '表面信息全部一致，但 INSPECT 显示设备指纹命中黑名单 BL-14，违反 R06，必须拒绝。',
    ['R06'],
  ],
  [
    '梅芙 · 阿尔坦', 'MEV ARSLAN', 8, 'anomaly', 'AL-05', 'UTC+03:00', 'tr-TR', 'AL-05', 'gpt-nova',
    '需要下载并运行离线 3D 渲染工具。', 'AL-PHONE-3', 'DAY 01 · 09:52',
    'INTENT_MISMATCH~访问理由与申请服务用途不符~warn',
    ['申请服务 GPT-NOVA 的用途为对话推理，不提供离线 3D 渲染。'],
    'DENY',
    'GPT-NOVA 用途为对话推理，申请人理由为离线 3D 渲染，违反 R05。',
    ['R05'],
  ],
  [
    '凯 · 奥利', 'KAI OLI', 19, 'special', 'OR-09', 'UTC+01:00', 'und', 'OR-09', 'claude-orbit',
    '需要长文本分析协助整理紧急医疗翻译记录。', 'OR-TAB-6', 'DAY 01 · 10:03',
    'LANG_MISSING~语言字段为 und，规则无法判定~warn',
    ['系统标记：语言字段因区服维护被清空，非申请人行为导致。', '同一时段共有 214 份申请出现相同字段缺失。'],
    'APPROVE',
    '语言字段缺失是系统维护造成的，非申请人过错；其余 R01/R02/R03/R05 全部通过，应放行。',
    ['R04'],
  ],
  [
    '萨米 · 哈立德', 'SAMI KHALID', 29, 'normal', 'SG-03', 'UTC+04:00', 'ar-AE', 'SG-03', 'muse-x',
    '需要图像生成协助输出产品概念图。', 'SG-PHONE-1', 'DAY 01 · 10:15', '',
    ['账号注册 1 年 4 个月，历史申请 0 次驳回。'],
    'APPROVE',
    'SG-03 已加入开放区，时区、账号地区、语言、用途全部一致，R01–R05 通过。',
    ['R01', 'R02', 'R03', 'R04', 'R05'],
  ],
  [
    '林 · 佐', 'RIN ZO', 3, 'inspect', 'KA-01', 'UTC+08:00', 'zh-CN', 'KA-01', 'gemini-drift',
    '需要多模态检索协助核对合同影像。', 'KA-LAPTOP-8', 'DAY 01 · 10:26', '',
    ['账号注册时间 2026-10-24 10:27，晚于本申请提交时间 10:26。', '账号在注册后 40 秒内即提交申请。'],
    'DENY',
    'INSPECT 显示账号注册时间晚于申请提交时间，属时间戳倒挂伪造，违反 R06。',
    ['R06'],
  ],
  [
    '德文 · 罗斯', 'DEVON ROSS', 31, 'conflict', 'BX-12', 'UTC+00:00', 'en-GB', 'BX-12', 'claude-orbit',
    '需要长文本分析协助归档边境通行记录。', 'BX-TERM-1', 'DAY 01 · 10:38',
    'RULE_CONFLICT~规则冲突：R01 拒绝 / R07 放行~alert',
    ['R07 由本级指挥部签发，优先级高于 R01。', 'BX-12 不在任何开放区名单中，但持有内部豁免编号 EX-07。'],
    'APPROVE',
    'R01 判定拒绝，但 R07 紧急豁免令优先级更高且明确覆盖 BX-12，应放行。',
    ['R01', 'R07'],
  ],
];

function decodeSignals(raw: string): Signal[] {
  if (!raw) return [];
  return raw.split('|').map((chunk) => {
    const [code, label, level] = chunk.split('~');
    return { code, label, level: level as Signal['level'] };
  });
}

/** 按旧版语义补回新字段：hiddenClues 非空即视为"需要开档才能判对" */
export const D00_VISITORS: Visitor[] = ROWS.map((row, index) => {
  const [
    name, alias, avatarSeed, tier, ipRegion, timezone, language, accountRegion, serviceId,
    reason, device, submittedAt, signals, hiddenClues, correct, explanation, ruleRefs,
  ] = row;
  const code = `V-${String(index + 1).padStart(3, '0')}`;
  const facts: VisitorFacts = {
    intentMatch: tier !== 'anomaly' || !ruleRefs.includes('R05'),
    blacklisted: ruleRefs.includes('R06') && code !== 'V-009',
    registeredLate: code === 'V-009',
    langMaintenance: code === 'V-007',
  };
  return {
    id: `v${String(index + 1).padStart(3, '0')}`,
    code,
    name,
    alias,
    avatarSeed,
    tier,
    ipRegion,
    timezone,
    language,
    accountRegion,
    serviceId,
    reason,
    device,
    submittedAt,
    signals: decodeSignals(signals),
    hiddenClues,
    correct,
    explanation,
    ruleRefs,
    day: 'D00',
    index,
    templateId: 'LEGACY-D00',
    requiresInspect: hiddenClues.length > 0,
    fingerprint: `d00|${code}`,
    facts,
  };
});
