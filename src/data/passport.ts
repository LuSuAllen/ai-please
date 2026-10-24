import type { Visitor } from '../types/game';
import { REGION_MAP } from './regions';

/**
 * 护照展示字段。
 *
 * 重要：这里只做“确定性派生”，只允许读 avatarSeed / 名字 / 地区这类
 * 本来就明文可见的字段。**禁止**读取 correct 或 signals —— 否则护照就成了答案表。
 */
export interface PassportView {
  /** 护照号 */
  no: string;
  /** 签发地（与账号地区一致，该值本来就明文可见） */
  issuedBy: string;
  /** 有效区间（游戏世界内时间） */
  validFrom: string;
  validTo: string;
  /** 历史盖章数量，纯氛围，与答案无关 */
  archiveCount: number;
  /** 历史盖章的入境口岸，纯氛围 */
  archiveStamps: string[];
}

const PORTS = ['WINDOW 01', 'WINDOW 02', 'WINDOW 04', 'WINDOW 07'];

export function derivePassport(visitor: Visitor): PassportView {
  const seed = Math.abs(visitor.avatarSeed);
  const digits = ((seed * 2654435761) % 9000000 + 1000000).toString();
  const region = REGION_MAP[visitor.accountRegion];
  const archiveCount = seed % 4;

  return {
    no: `PL-${digits.slice(0, 7)}`,
    issuedBy: region ? `${region.code} · ${region.name}` : visitor.accountRegion,
    validFrom: 'DAY 001',
    validTo: `DAY ${String(30 + (seed % 11) * 10).padStart(3, '0')}`,
    archiveCount,
    archiveStamps: Array.from(
      { length: archiveCount },
      (_, i) => PORTS[(seed + i * 3) % PORTS.length],
    ),
  };
}
