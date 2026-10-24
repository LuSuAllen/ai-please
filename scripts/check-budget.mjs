#!/usr/bin/env node
/**
 * 产物预算门禁（DOD：JS gzip ≤ 70kB，总产物 ≤ 260kB）。
 * 读 dist/ 实际文件，不信任框架自报数字；超了就退出码 1，CI 直接红。
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

/** 首屏（index.html 直接引用/预加载）JS gzip 预算：用户真正要下载才能开玩的体积 */
const INITIAL_JS_GZIP_BUDGET = 70 * 1000;
/** 全部 JS gzip 硬上限：按需包（v2 旧档迁移用的 D00 快照）也计入，防止悄悄膨胀 */
const ALL_JS_GZIP_BUDGET = 74 * 1000;
/** 首屏 CSS gzip 预算：样式随 HTML 阻塞渲染，同样要设上限（第九轮新增） */
const INITIAL_CSS_GZIP_BUDGET = 6200;
const TOTAL_RAW_BUDGET = 260 * 1000;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const files = await walk('dist');
const html = await readFile('dist/index.html', 'utf8');
// index.html 里出现过的 js 就是首屏要下载的；按需 chunk 不会出现在这里
const initialJs = new Set(
  // 兼容 GitHub Pages 的 /ai-please/ base 前缀
  [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.js)"/g)].map((m) => path.join('dist', m[1])),
);
const initialCss = new Set(
  [...html.matchAll(/(?:src|href)="[^"]*?\/?(assets\/[^"]+\.css)"/g)].map((m) => path.join('dist', m[1])),
);

let jsGzip = 0;
let initialGzip = 0;
let initialCssGzip = 0;
let totalRaw = 0;
const rows = [];

for (const file of files) {
  const buffer = await readFile(file);
  const info = await stat(file);
  totalRaw += info.size;
  if (file.endsWith('.css')) {
    const gz = gzipSync(buffer, { level: 9 }).length;
    if (initialCss.has(file)) initialCssGzip += gz;
  }
  if (file.endsWith('.js')) {
    const gz = gzipSync(buffer, { level: 9 }).length;
    const lazy = !initialJs.has(file);
    jsGzip += gz;
    if (!lazy) initialGzip += gz;
    rows.push({ file: path.relative('dist', file), raw: info.size, gzip: gz, lazy });
  }
}

rows.sort((a, b) => b.gzip - a.gzip);
for (const row of rows) {
  const tag = row.lazy ? '按需' : '首屏';
  console.log(
    `  [${tag}] ${row.file.padEnd(26)} raw ${(row.raw / 1000).toFixed(2)}kB  gzip ${(row.gzip / 1000).toFixed(2)}kB`,
  );
}

const initialRatio = (initialGzip / INITIAL_JS_GZIP_BUDGET) * 100;
const allRatio = (jsGzip / ALL_JS_GZIP_BUDGET) * 100;
const cssRatio = (initialCssGzip / INITIAL_CSS_GZIP_BUDGET) * 100;
const totalRatio = (totalRaw / TOTAL_RAW_BUDGET) * 100;
console.log(`\n首屏 JS   ${(initialGzip / 1000).toFixed(2)}kB / 70kB   (${initialRatio.toFixed(1)}%)`);
console.log(`全部 JS   ${(jsGzip / 1000).toFixed(2)}kB / 74kB   (${allRatio.toFixed(1)}%)`);
console.log(`[首屏CSS] ${(initialCssGzip / 1000).toFixed(2)}kB / 6.2kB  (${cssRatio.toFixed(1)}%)`);
console.log(`总产物    ${(totalRaw / 1000).toFixed(2)}kB / 260kB  (${totalRatio.toFixed(1)}%)`);

const failures = [];
if (initialGzip > INITIAL_JS_GZIP_BUDGET) failures.push(`首屏 JS gzip 超预算：${(initialGzip / 1000).toFixed(2)}kB > 70kB`);
if (jsGzip > ALL_JS_GZIP_BUDGET) failures.push(`全部 JS gzip 超上限：${(jsGzip / 1000).toFixed(2)}kB > 74kB`);
if (initialCssGzip > INITIAL_CSS_GZIP_BUDGET)
  failures.push(`[首屏CSS] gzip 超预算：${(initialCssGzip / 1000).toFixed(2)}kB > 6.2kB`);
if (totalRaw > TOTAL_RAW_BUDGET) failures.push(`总产物超预算：${(totalRaw / 1000).toFixed(2)}kB > 260kB`);

if (failures.length) {
  console.error(`\n✖ 预算门禁未通过：\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}
console.log('\n✔ 预算门禁通过');
