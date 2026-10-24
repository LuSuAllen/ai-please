/**
 * 确定性随机数：mulberry32 + FNV-1a。
 * 生成路径禁止使用 Math.random / Date.now / 不稳定排序。
 * 只使用可擦除 TypeScript 语法，保证 node --experimental-strip-types 可直接跑测试。
 */

export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  /** [0,1) 浮点 */
  next(): number;
  /** [0,n) 整数 */
  int(n: number): number;
  /** 取数组元素 */
  pick<T>(items: readonly T[]): T;
  /** 洗牌（Fisher-Yates，返回新数组） */
  shuffle<T>(items: readonly T[]): T[];
  /** 派生命名子流，不影响当前流位置 */
  fork(label: string): Rng;
}

export function createRng(seedValue: number): Rng {
  let a = seedValue >>> 0;
  const nextU32 = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const rng: Rng = {
    next() {
      return nextU32() / 4294967296;
    },
    int(n: number) {
      if (n <= 0) return 0;
      return Math.floor((nextU32() / 4294967296) * n);
    },
    pick<T>(items: readonly T[]): T {
      return items[rng.int(items.length)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = rng.int(i + 1);
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    fork(label: string) {
      return createRng(hash32(`${seedValue >>> 0}|${label}`));
    },
  };
  return rng;
}

export const GEN_VERSION = 1;

export function masterSeed(dayId: string, seed: number): number {
  return hash32(`ai-please|v${GEN_VERSION}|${dayId}|${seed}`);
}
