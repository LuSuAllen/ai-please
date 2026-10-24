import type { Region, Service } from '../types/game';

/**
 * 虚构地区注册表。
 * 所有地区、时区、语言均为游戏世界观设定，不对应任何真实国家的实际网络政策。
 */
export const REGIONS: Region[] = [
  { code: 'KA-01', name: '银河自由区', timezone: 'UTC+08:00', language: 'zh-CN', openFrom: 0, openUntil: null, neverOpen: false },
  { code: 'NA-04', name: '北岸区', timezone: 'UTC+09:00', language: 'ja-JP', openFrom: 0, openUntil: null, neverOpen: false },
  { code: 'OR-09', name: '东岸开发区', timezone: 'UTC+01:00', language: 'de-DE', openFrom: 0, openUntil: null, neverOpen: false },
  { code: 'VM-02', name: '云母区', timezone: 'UTC-05:00', language: 'en-US', openFrom: 0, openUntil: null, neverOpen: false },
  { code: 'AL-05', name: '高山特区', timezone: 'UTC+03:00', language: 'tr-TR', openFrom: 0, openUntil: null, neverOpen: false },
  { code: 'TZ-07', name: '赤道缓冲区', timezone: 'UTC+07:00', language: 'th-TH', openFrom: 0, openUntil: 6, neverOpen: false },
  { code: 'SG-03', name: '沙丘区', timezone: 'UTC+04:00', language: 'ar-AE', openFrom: 6, openUntil: null, neverOpen: false },
  { code: 'BX-12', name: '边境中立区', timezone: 'UTC+00:00', language: 'en-GB', openFrom: 0, openUntil: null, neverOpen: true },
];

export const REGION_MAP: Record<string, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.code, r]),
);

/** 该地区在第 index 位访客时是否属于开放区 */
export function isOpen(code: string, index: number): boolean {
  const r = REGION_MAP[code];
  if (!r || r.neverOpen) return false;
  if (index < r.openFrom) return false;
  if (r.openUntil !== null && index >= r.openUntil) return false;
  return true;
}

export const SERVICES: Service[] = [
  { id: 'gpt-nova', name: 'GPT-NOVA', intent: '对话推理' },
  { id: 'claude-orbit', name: 'CLAUDE-ORBIT', intent: '长文本分析' },
  { id: 'gemini-drift', name: 'GEMINI-DRIFT', intent: '多模态检索' },
  { id: 'muse-x', name: 'MUSE-X', intent: '图像生成' },
  { id: 'codex-dune', name: 'CODEX-DUNE', intent: '代码补全' },
];

export const SERVICE_MAP: Record<string, Service> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s]),
);
