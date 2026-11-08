// 小工具产物后处理：classic 脚本化 + Chrome 61 基线 CSS 回退 + flex-gap 探测
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const root = path.resolve(process.cwd(), 'dist-minitool');
const htmlPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'assets/style.css');
const report = { html: [], css: [], flexGapRules: 0, gridGap: 0, skipped: [] };

// ---------- 1. index.html：去 module/crossorigin，注入 compat.js ----------
let html = fs.readFileSync(htmlPath, 'utf8');
const before = html;
html = html.replace(/\s+type="module"/g, '').replace(/\s+crossorigin/g, '');
// classic 脚本必须 defer：模块脚本天生延迟执行，改成 classic 后需显式声明
html = html.replace(/<script([^>]*src="\.\/assets\/app\.js"[^>]*)>/g, (m, attrs) =>
  attrs.includes('defer') ? m : `<script defer${attrs}>`
);
if (!html.includes('compat.js')) {
  html = html.replace(
    /(<script defer[^>]*src="\.\/assets\/app\.js"[^>]*>)/,
    (m) => `<script src="./assets/compat.js"></script>\n    ${m}`
  );
}
if (!/defer[^>]*assets\/app\.js|assets\/app\.js[^>]*defer/.test(html)) throw new Error('app.js 缺少 defer');
if (/type="module"|crossorigin/.test(html)) throw new Error('HTML 仍有 module/crossorigin');
if (!html.includes('compat.js')) throw new Error('compat.js 未注入');
fs.writeFileSync(htmlPath, html);
report.html.push(`script/link 已 classic 化，compat.js 已注入 (${before.length}→${html.length} bytes)`);

// ---------- 2. CSS：Chrome 61 回退 ----------
const css = fs.readFileSync(cssPath, 'utf8');
const ast = postcss.parse(css);

const FUNC_FALLBACK = [
  ['min(92vw,430px)', '92vw'],
  ['min(94dvh,920px)', '94vh'],
  ['max(8px,0px)', '8px'],
  ['clamp(30px,11.5vw,44px)', '11.5vw'],
];

function envFallback(value) {
  // env(safe-area-inset-top,0px) -> 0px（Android Chrome 61 安全区为 0）
  return value.replace(/env\(\s*[a-z-]+\s*,\s*([^)]+)\)/gi, '$1').replace(/env\(\s*[a-z-]+\s*\)/gi, '0px');
}

const counts = { env: 0, func: 0, dvh: 0, backdrop: 0, aspect: 0 };

ast.walkDecls((decl) => {
  const original = decl.value;
  let v = original;
  let changed = false;

  if (v.includes('env(')) {
    const fb = envFallback(v);
    if (fb !== v) { v = fb; changed = true; counts.env++; }
  }

  for (const [from, to] of FUNC_FALLBACK) {
    if (v.includes(from)) { v = v.split(from).join(to); changed = true; counts.func++; }
  }

  if (!v.includes('min(') && v.includes('dvh')) {
    v = v.replace(/dvh/g, 'vh');
    changed = true;
    counts.dvh++;
  }

  if (changed) {
    decl.cloneBefore({ value: v });
    decl.value = v;
    report.css.push(`${decl.prop}: ${original} → fallback ${v}`);
  }

  if (decl.prop === 'backdrop-filter') {
    decl.cloneBefore({ prop: '-webkit-backdrop-filter' });
    counts.backdrop++;
  }

  if (decl.prop === 'aspect-ratio' && !decl.parent.nodes.some((n) => n.prop === 'width' && /vh$/.test(n.value || ''))) {
    decl.cloneBefore({ prop: 'width', value: '52.875vh' }); // 94vh * 9/16
    counts.aspect++;
  }
});

// ---------- 3. gap 回退：grid → grid-gap；flex → html.no-flex-gap 相邻兄弟 margin ----------
const flexRules = [];
let gridGap = 0;

ast.walkRules((rule) => {
  if (!rule.nodes) return;
  const display = rule.nodes.find((n) => n.type === 'decl' && n.prop === 'display');
  const gap = rule.nodes.find((n) => n.type === 'decl' && (n.prop === 'gap' || n.prop === 'grid-gap'));
  if (!gap || !display) return;

  const isGrid = /grid/.test(display.value);
  const isFlex = /flex/.test(display.value);
  if (!isGrid && !isFlex) return;

  const parts = gap.value.trim().split(/\s+/);
  if (parts.length > 2) {
    report.skipped.push(`gap 值无法解析: ${rule.selector} { gap: ${gap.value} }`);
    return;
  }

  if (isGrid) {
    if (gap.prop !== 'grid-gap') {
      gap.cloneBefore({ prop: 'grid-gap' });
      gridGap++;
    }
    return;
  }

  const dirDecl = rule.nodes.find((n) => n.type === 'decl' && n.prop === 'flex-direction');
  const vertical = dirDecl ? /column/.test(dirDecl.value) : false;
  const rowGap = parts[0];
  const colGap = parts[1] ?? parts[0];
  const margin = vertical ? rowGap : colGap;
  if (!margin || margin === '0' || margin === '0px') return;

  for (const sel of rule.selectors) {
    flexRules.push(`html.no-flex-gap ${sel} > * + *{margin-${vertical ? 'top' : 'left'}:${margin}}`);
  }
});

// 容器全屏留白只在小工具产物里生效：webview 从屏幕顶端渲染，系统状态栏与容器导航条
// 都浮在页面上方，且容器内 env() 恒为 0，所以用固定值覆盖；网页版保持原 env() 安全区。
const FULLSCREEN_INSET = [
  ':root{--pad-top:104px;--pad-bottom:56px}',
  '.statusbar{padding:var(--pad-top) var(--pad) 10px}',
  '.actionbar{padding:9px var(--pad) var(--pad-bottom)}',
  '.storage-warning{top:var(--pad-top)}',
  '.sheet-foot{padding:10px 11px 12px}',
  '.drawer .sheet-foot{padding-bottom:var(--pad-bottom)}',
  '.home{padding:calc(var(--pad-top) + 14px) 18px calc(var(--pad-bottom) + 14px)}',
  '.result{padding:calc(var(--pad-top) + 10px) var(--pad) calc(var(--pad-bottom) + 10px)}',
  '.toast-wrap{top:calc(var(--pad-top) + 108px)}',
].join('\n');
ast.append(FULLSCREEN_INSET);
report.css.push('容器全屏留白已注入：--pad-top 104px / --pad-bottom 56px（仅小工具产物）');

if (flexRules.length) {
  ast.append(flexRules.join('\n'));
}
report.flexGapRules = flexRules.length;
report.gridGap = gridGap;
report.css.unshift(
  `env 回退 ${counts.env} 处；min/max/clamp 回退 ${counts.func} 处；dvh 回退 ${counts.dvh} 处；` +
  `backdrop-filter 前缀 ${counts.backdrop} 处；aspect-ratio 宽度回退 ${counts.aspect} 处；` +
  `grid-gap ${gridGap} 处；flex-gap margin 规则 ${flexRules.length} 条`
);

fs.writeFileSync(cssPath, ast.toString());

// ---------- 4. compat.js：探测 flex gap，不支持则加 class ----------
const compat = `(function(){try{
var de=document.documentElement;
var box=document.createElement('div');
box.style.cssText='position:absolute;top:-9999px;left:-9999px;display:flex;flex-direction:column;gap:1px;width:10px';
var a=document.createElement('div'),b=document.createElement('div');
a.style.height='1px';b.style.height='1px';
box.appendChild(a);box.appendChild(b);de.appendChild(box);
var h=box.getBoundingClientRect().height;
de.removeChild(box);
if(!(h>2.5)){de.className=de.className?de.className+' no-flex-gap':'no-flex-gap';}
}catch(e){}})();`;
fs.writeFileSync(path.join(root, 'assets/compat.js'), compat);

// ---------- 5. 断言 ----------
const finalHtml = fs.readFileSync(htmlPath, 'utf8');
const finalCss = fs.readFileSync(cssPath, 'utf8');
const problems = [];
if (/type="module"/.test(finalHtml)) problems.push('HTML: type="module" 残留');
if (/<script(?![^>]*src=)[^>]*>[\s\S]*?<\/script>/.test(finalHtml)) problems.push('HTML: 内联脚本');
if (/env\(|dvh|clamp\(|min\(92vw|max\(8px/.test(finalCss)) problems.push('CSS: 现代函数残留');
if (problems.length) throw new Error(problems.join('; '));

console.log('POSTPROCESS_JSON=' + JSON.stringify(report, null, 2));
