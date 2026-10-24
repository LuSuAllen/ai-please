import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * S5-A3 展示预算门禁：动画只允许白名单内的名字与时长，防止「炫技式」动画拖慢低端机。
 * 直接读源码 CSS 文本，不依赖构建产物，任何新增动画都会被这里拦住。
 */
const CSS = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');

/** 允许的动画名 → 允许的时长（显式白名单，新增动画必须同时登记时长） */
const ALLOWED: Record<string, readonly string[]> = {
  'fade-in': ['120ms'],
  'slide-up': ['160ms'],
  'slide-down': ['180ms'],
  'stamp-in': ['320ms', '380ms'],
  'stamp-in-alt': ['380ms'],
  'pip-pulse': ['1.1s'],
  blink: ['1.2s'],
};

/** 允许无限循环的动画（只允许这两个，且总数 ≤ 2） */
const ALLOWED_INFINITE = new Set(['pip-pulse', 'blink']);
/** 白名单之外的动画总时长硬上限 */
const MAX_ANIMATION_MS = 400;

interface Anim {
  name: string;
  duration: string;
  infinite: boolean;
  line: number;
}

function toMs(duration: string): number {
  const n = Number.parseFloat(duration);
  return duration.endsWith('ms') ? n : n * 1000;
}

function parseAnimations(css: string): Anim[] {
  const out: Anim[] = [];
  const lines = css.split('\n');
  lines.forEach((line, i) => {
    const shorthand = line.match(/animation:\s*([a-zA-Z][\w-]*)\s+([\d.]+m?s)\b/);
    if (shorthand) {
      out.push({ name: shorthand[1], duration: shorthand[2], infinite: /\binfinite\b/.test(line), line: i + 1 });
    }
  });
  // animation-name 覆盖：沿用同一选择器块的 animation 时长（stamp-in-alt 复用 380ms）
  lines.forEach((line, i) => {
    const named = line.match(/animation-name:\s*([a-zA-Z][\w-]*)\s*;/);
    if (!named) return;
    const previous = out.at(-1);
    out.push({ name: named[1], duration: previous?.duration ?? '0ms', infinite: false, line: i + 1 });
  });
  return out;
}

const ANIMATIONS = parseAnimations(CSS);

test('display-budget: 每个动画都在白名单内，且时长与登记一致', () => {
  assert.ok(ANIMATIONS.length > 0, '应当解析到动画声明');
  for (const anim of ANIMATIONS) {
    const allowed = ALLOWED[anim.name];
    assert.ok(allowed, `未登记动画 ${anim.name}（第 ${anim.line} 行）；请先在 ALLOWED 里登记用途与时长`);
    assert.ok(
      allowed.includes(anim.duration),
      `动画 ${anim.name} 时长 ${anim.duration} 不在白名单 [${allowed.join(', ')}]（第 ${anim.line} 行）`,
    );
    assert.ok(
      toMs(anim.duration) <= MAX_ANIMATION_MS || ALLOWED_INFINITE.has(anim.name),
      `动画 ${anim.name} 时长 ${anim.duration} 超过 ${MAX_ANIMATION_MS}ms 上限（第 ${anim.line} 行）`,
    );
  }
});

test('display-budget: 无限循环动画只允许 pip-pulse / blink，且总数 ≤ 2', () => {
  const infinite = ANIMATIONS.filter((a) => a.infinite).map((a) => a.name);
  assert.ok(infinite.length <= 2, `无限循环动画过多：${infinite.join(', ')}`);
  for (const name of infinite) {
    assert.ok(ALLOWED_INFINITE.has(name), `不允许无限循环的动画：${name}`);
  }
});

test('display-budget: 交互过渡不超过 60ms 的按钮节奏（只允许 steps 离散过渡）', () => {
  const transitions = [...CSS.matchAll(/transition:\s*([^;]+);/g)].map((m) => m[1]);
  assert.ok(transitions.length > 0, '应当解析到 transition 声明');
  for (const value of transitions) {
    for (const part of value.split(',')) {
      const durations = [...part.matchAll(/([\d.]+m?s)\b/g)].map((m) => m[1]);
      for (const d of durations) assert.ok(toMs(d) <= 60, `过渡时长 ${d} 超过 60ms：${part.trim()}`);
    }
  }
});
