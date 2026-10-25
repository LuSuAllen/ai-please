#!/usr/bin/env node
/**
 * v3 acceptance：多关卡 + 种子随机的独立验收（Node >= 22，本机 Chrome，无 npm 依赖）。
 * Usage: node --experimental-strip-types scripts/verify-v3.mjs --url http://127.0.0.1:4175
 *   --url 站点地址 / --chrome Chrome 路径 / --out 证据目录
 * 只启动一个隔离的 headless Chrome；不启动应用服务器、不发布、不读任何既有浏览器配置。
 * Exit 0 = 本轮全部断言通过；1 = 断言失败；2 = 探针自身错误。
 *
 * 关键点：判定答案由 node 侧调用同一份 generator/rules-eval 现算，
 * 因此这里验证的是"UI 记录的判定 == oracle 判定"，而不是脚本自己谎报的期待值。
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { generateRun } from '../src/game/generator.ts';

const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  console.log('node --experimental-strip-types scripts/verify-v3.mjs --url http://127.0.0.1:4175 [--chrome PATH] [--out DIR]');
  process.exit(0);
}
const opts = {};
for (let i = 0; i < argv.length; i += 2) {
  if (!['--url', '--chrome', '--out', '--only'].includes(argv[i]) || !argv[i + 1]) throw new Error(`Invalid argument: ${argv[i]}`);
  opts[argv[i].slice(2)] = argv[i + 1];
}
const url = new URL(opts.url || 'http://127.0.0.1:4175');
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without credentials');
const out = path.resolve(opts.out || path.join(tmpdir(), `ai-please-v3-evidence-${Date.now()}`));
const chromePath = opts.chrome || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const RUN_KEY = 'ai-please:run:v3';
const META_KEY = 'ai-please:meta:v3';
const LEGACY_RUN = 'ai-please:run:v2';
const LEGACY_META = 'ai-please:meta:v2';
const SEED = 20261024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = {
  startedAt: new Date().toISOString(),
  url: url.href,
  assertions: [],
  scenarios: [],
  runtimeErrors: [],
  caveats: [
    'Single Chromium viewport family (1280×900 主视口 + 320×568 溢出自检)，非跨浏览器认证。',
    '判定答案由 node 侧同一份 generator 现算后驱动真实点击；脚本不读取页面里的正确答案。',
  ],
};
let chrome, profile, current, exit = 2, shotId = 0;
const clients = new Set();

function assert(ok, name, actual) {
  report.assertions.push({ name, pass: Boolean(ok), actual });
  if (!ok) throw new Error(`ASSERTION: ${name}; actual=${JSON.stringify(actual)}`);
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        clearTimeout(p.timer); this.pending.delete(m.id);
        m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
      } else if (m.method === 'Runtime.exceptionThrown') {
        report.runtimeErrors.push({ scenario: report.scenarios.at(-1)?.name, detail: m.params.exceptionDetails });
      }
    });
  }
  static async open(endpoint) {
    const ws = new WebSocket(endpoint);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
    const c = new CDP(ws); clients.add(c); return c;
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`Browser evaluation: ${JSON.stringify(r.exceptionDetails)}`);
    return r.result.value;
  }
  close() {
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')); }
    this.pending.clear(); this.ws.close(); clients.delete(this);
  }
}

let endpoint;
const fixtureRun = (day, seed = SEED) => {
  const run = generateRun(day, seed);
  if (!run) throw new Error(`generator failed: ${day}/${seed}`);
  return run;
};
const savedShape = (run, index = 0) => ({
  v: 3, seed: run.seed, genVersion: run.genVersion, day: run.day, total: run.total, run,
  index, score: index * 10, funds: 500, inspected: false, inspectedCount: 0,
  records: [], seenUpdates: run.updates.filter((u) => u.atIndex < index).map((u) => u.atIndex),
  pendingUpdate: null, phase: 'playing', lastRecord: null,
});

async function page({ query = '', meta = {}, v3 = null, legacy = null, storageFault = null, width = 1280, height = 900 } = {}) {
  if (current) { const old = current; current = null; await old.send('Page.close').catch(() => {}); old.close(); }
  const target = await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  current = await CDP.open(target.webSocketDebuggerUrl);
  await current.send('Page.enable'); await current.send('Runtime.enable'); await current.send('Network.enable');
  await current.send('Network.setCacheDisabled', { cacheDisabled: true });
  // 无头窗口里键盘事件需要显式焦点仿真，否则 Escape/Tab 可能被丢弃
  await current.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await current.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const metaPayload = { schema: 3, tutorialSeen: true, muted: true, bestScore: 0, bestByDay: {}, unlockedDay: 'D01', ...meta };
  const source = `(() => {
    const nativeGet = Storage.prototype.getItem;
    if (!sessionStorage.getItem('v3-probe-seeded')) {
      localStorage.clear();
      localStorage.setItem(${JSON.stringify(META_KEY)}, JSON.stringify(${JSON.stringify(metaPayload)}));
      ${v3 ? `localStorage.setItem(${JSON.stringify(RUN_KEY)}, ${JSON.stringify(JSON.stringify(v3))});` : ''}
      ${legacy ? `localStorage.setItem(${JSON.stringify(LEGACY_RUN)}, ${JSON.stringify(JSON.stringify(legacy))});` : ''}
      sessionStorage.setItem('v3-probe-seeded', '1');
    }
    ${storageFault ? `Object.defineProperty(Storage.prototype, ${JSON.stringify(storageFault)}, { configurable: true, value: function(...args) { if (this === window.localStorage) throw new DOMException('V3_PROBE_STORAGE_FAILURE', '${storageFault === 'setItem' ? 'QuotaExceededError' : 'SecurityError'}'); return ${storageFault === 'getItem' ? 'nativeGet' : 'function(){}'}.apply(this, args); } });` : ''}
  })();`;
  await current.send('Page.addScriptToEvaluateOnNewDocument', { source });
  const dest = new URL(url);
  dest.search = query;
  dest.searchParams.set('v3_probe', String(Date.now()));
  await current.send('Page.navigate', { url: dest.href });
  await wait(`document.querySelector('.shell') && document.querySelector('.shell').innerText.length > 30`, 'app shell rendered');
}

async function wait(expression, label, timeout = 8000) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { last = await current.eval(`!!(${expression})`); if (last) return last; await sleep(70); }
  throw new Error(`Timeout: ${label}; last=${JSON.stringify(last)}`);
}
async function shot(label) {
  const name = `${String(++shotId).padStart(3, '0')}-${label.replace(/[^a-z0-9-]/gi, '-')}.png`;
  const s = await current.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  await writeFile(path.join(out, name), Buffer.from(s.data, 'base64'));
  report.scenarios.at(-1)?.screenshots.push(name);
}
async function runState() { return current.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(RUN_KEY)}))`); }
async function metaState() { return current.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(META_KEY)}))`); }
async function persisted(predicate, label) { return wait(`(${predicate})(JSON.parse(localStorage.getItem(${JSON.stringify(RUN_KEY)})))`, label); }
async function bodyText() { return current.eval('document.body.innerText'); }
async function reloadResume() {
  await current.send('Page.reload', { ignoreCache: true });
  await wait(`document.querySelector('.home-buttons')`, 'home after refresh');
  await clickText('RESUME');
  await wait(`document.querySelector('.actionbar')`, 'resume game');
}
async function click(selector) {
  const pos = await current.eval(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw Error('Missing '+${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; const hit=document.elementFromPoint(x,y); return {x,y,disabled:!!e.disabled,hit:hit===e||e.contains(hit)}; })()`);
  assert(!pos.disabled && pos.hit, `real-click reachable: ${selector}`, pos);
  await current.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
  await current.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await current.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
}
async function clickText(text) {
  await wait(`Array.from(document.querySelectorAll('button')).some(e=>e.innerText.includes(${JSON.stringify(text)}))`, `button ${text}`);
  await current.eval(`(() => { document.querySelectorAll('[data-v3-probe]').forEach(e=>e.removeAttribute('data-v3-probe')); const e=Array.from(document.querySelectorAll('button')).find(e=>e.innerText.includes(${JSON.stringify(text)})); e.setAttribute('data-v3-probe','1'); })()`);
  return click('[data-v3-probe="1"]');
}
async function key(k, shift = false) {
  const codes = { Enter: ['Enter', 13, '\r'], ' ': ['Space', 32, ' '], Tab: ['Tab', 9, undefined], Escape: ['Escape', 27, undefined] };
  const [code, n, text] = codes[k];
  const p = { key: k, code, windowsVirtualKeyCode: n, nativeVirtualKeyCode: n, modifiers: shift ? 8 : 0, ...(text ? { text, unmodifiedText: text } : {}) };
  await current.send('Input.dispatchKeyEvent', { type: 'keyDown', ...p });
  await current.send('Input.dispatchKeyEvent', { type: 'keyUp', ...p });
}
async function judge(move) {
  await click(`.actionbar .btn-${move === 'APPROVE' ? 'approve' : 'deny'}`);
  await wait(`document.querySelector('.feedback')`, 'review feedback');
}
async function leaveFeedback(isLast) {
  await clickText(isLast ? 'PROCEED TO DEBRIEF' : 'NEXT VISITOR');
  await wait(`!document.querySelector('.feedback')`, 'left feedback');
}
async function ackToast(index) {
  await wait(`document.querySelector('.toast-wrap')`, `broadcast ${index}`);
  const detail = await current.eval(`document.querySelector('.t-detail').innerText`);
  assert(detail.length > 0, `broadcast ${index}: 有广播正文`, detail);
  assert(await current.eval(`Array.from(document.querySelectorAll('.actionbar button')).every(e=>e.disabled)`), `broadcast ${index}: ACK 前锁定判定`);
  await shot(`broadcast-${index}-unacked`);
  await reloadResume();
  assert(await current.eval(`document.querySelector('.t-detail')?.innerText`) === detail, `broadcast ${index}: 未 ACK 的广播刷新后仍在`, detail);
  await clickText('ACKNOWLEDGE');
  await wait(`!document.querySelector('.toast-wrap')`, 'ACK hides broadcast');
  await persisted(`s=>s?.seenUpdates?.includes(${index}) && s?.pendingUpdate===null`, `ACK ${index} persisted`);
  await reloadResume();
  assert(!(await current.eval(`!!document.querySelector('.toast-wrap')`)), `broadcast ${index}: 已 ACK 不重复出现`);
}
async function scenario(name, fn) {
  if (opts.only && !name.includes(opts.only)) return;
  const entry = { name, pass: false, screenshots: [] };
  report.scenarios.push(entry);
  try { await fn(); entry.pass = true; console.log(`PASS ${name}`); }
  catch (e) {
    entry.error = String(e.stack || e);
    console.error(`FAIL ${name}: ${e.message}`);
    if (current) await shot(`${name}-failure`).catch((error) => { entry.screenshotError = String(error); });
  }
}
async function modalFocus(selector, opener, { escape = true } = {}) {
  await wait(`document.querySelector(${JSON.stringify(selector)})`, 'modal visible');
  assert(await current.eval(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); return e.getAttribute('role')==='dialog' && e.getAttribute('aria-modal')==='true' && !!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')); })()`), `${selector}: named modal semantics`);
  await wait(`document.querySelector(${JSON.stringify(selector)}).contains(document.activeElement)`, 'initial modal focus');
  for (const backwards of [false, true]) {
    await current.eval(`(() => { const root=document.querySelector(${JSON.stringify(selector)}); const all=Array.from(root.querySelectorAll('button,[href],input,select,textarea,[tabindex]')).filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length); if(!all.length) throw Error('No modal focusables'); (${backwards} ? all[0] : all.at(-1)).focus(); })()`);
    await key('Tab', backwards);
    assert(await current.eval(`document.querySelector(${JSON.stringify(selector)}).contains(document.activeElement)`), `${selector}: ${backwards ? 'Shift+Tab' : 'Tab'} focus containment`);
  }
  if (escape) {
    await key('Escape');
    await wait(`!document.querySelector(${JSON.stringify(selector)})`, 'Escape closes modal');
    if (opener) assert(await current.eval(`document.activeElement===document.querySelector(${JSON.stringify(opener)})`), `${selector}: focus restored to opener`);
  }
}

try {
  if (typeof WebSocket === 'undefined') throw new Error('Node >=22 with built-in WebSocket required');
  await mkdir(out, { recursive: true });
  profile = await mkdtemp(path.join(tmpdir(), 'ai-please-v3-chrome-'));
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  endpoint = `http://127.0.0.1:${port}`;
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--no-proxy-server', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let spawnError, chromeLog = '';
  chrome.on('error', (e) => { spawnError = e; });
  chrome.stderr.on('data', (data) => { chromeLog = (chromeLog + data.toString()).slice(-4000); });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    try { const r = await fetch(`${endpoint}/json/version`); if (r.ok) { report.browser = await r.json(); ready = true; break; } } catch {}
    await sleep(100);
  }
  if (!ready) throw new Error(`Chrome CDP unavailable: ${chromeLog}`);

  // D01/D02/D03 的三局由 node 侧现算，UI 只负责呈现与记录
  const day1 = fixtureRun('D01');
  const day2 = fixtureRun('D02');
  const day3 = fixtureRun('D03');
  const day4 = fixtureRun('D04');

  await scenario('seeded-day1-full-run-judged-by-oracle', async () => {
    await page({ query: `?day=D01&seed=${day1.seed}` });
    await wait(`document.querySelector('.actionbar')`, 'seeded launch skips home');
    assert((await runState())?.total === day1.total, 'URL seed 直接进入 8 人班次', (await runState())?.total);
    for (let i = 0; i < day1.total; i += 1) {
      const v = day1.visitors[i];
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `visitor ${v.code} rendered`);
      const text = await bodyText();
      assert(!text.includes(v.explanation), `${v.code}: 判定前 DOM 不含解释`, v.explanation.slice(0, 20));
      for (const clue of v.hiddenClues) assert(!text.includes(clue), `${v.code}: 判定前 DOM 不含开档线索`);
      assert(
        !/VERDICT (ACCEPTED|REJECTED)/.test(text) && !/判定正确|判定错误/.test(text),
        `${v.code}: 判定前无结算层（中英双证）`,
      );
      for (const update of day1.updates.filter((u) => u.atIndex === i)) await ackToast(update.atIndex);
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `visitor ${v.code} after ACK`);

      // 第 4 位故意判错：验证审计层能抓出误判，而不是无脑给分
      const move = i === 3 ? (v.correct === 'APPROVE' ? 'DENY' : 'APPROVE') : v.correct;
      await judge(move);
      const record = await current.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(RUN_KEY)}))?.records?.at(-1)`);
      assert(record?.code === v.code, `${v.code}: 存档记录绑定当前访客`, record?.code);
      assert(record?.correct === v.correct, `${v.code}: 存档答案 == oracle`, record?.correct);
      assert(record?.isCorrect === (move === v.correct), `${v.code}: 判定结果符合预期`, record?.isCorrect);
      const feedback = await current.eval(`document.querySelector('.feedback')?.innerText ?? ''`);
      assert(feedback.includes(v.correct), `${v.code}: 判定后反馈层揭示应授权限`, v.correct);
      // 双语层：结论必须中文化，英文锚点仍留在 DOM（隐藏英文 = 契约失效）
      const sheetText = await current.eval(`document.querySelector('.sheet')?.innerText ?? ''`);
      assert(/判定正确|判定错误/.test(sheetText), `${v.code}: 反馈层中文结论可见`, sheetText.slice(0, 40));
      const stampText = await current.eval(
        `document.querySelector('.feedback .stamp')?.innerText ?? ''`,
      );
      assert(
        /(正确|错误)/.test(stampText) && /(CORRECT|WRONG)/.test(stampText),
        `${v.code}: 印章中英并存`,
        stampText,
      );
      assert(/你的判定：.*应为：/.test(feedback), `${v.code}: 中英对照行可见`);
      if (!record.isCorrect) {
        assert(
          /(误放行 · 应判拒绝|误拒绝 · 应判放行)/.test(feedback),
          `${v.code}: 判错时给出错型归因`,
          feedback.slice(0, 60),
        );
      }
      // 账目：文案随便改，数字必须与存档一致（这才是汉化不会改坏数值的证据）
      const deltas = await current.eval(
        `(() => Array.from(document.querySelectorAll('.feedback .delta')).map((e) => ({ kind: e.dataset.kind, d: Number(e.dataset.delta) })))()`,
      );
      assert(
        deltas.some((x) => x.kind === 'score' && x.d === record.scoreDelta),
        `${v.code}: 分数 chip 数值 == 存档`,
        deltas,
      );
      assert(
        deltas.some((x) => x.kind === 'funds' && x.d === record.fundDelta),
        `${v.code}: 预算 chip 数值 == 存档`,
        deltas,
      );
      if (record.inspected) {
        assert(deltas.some((x) => x.kind === 'inspect'), `${v.code}: 开档支出单列一行`, deltas);
      }
      assert(/账户\s*-?\d+\s*→\s*-?\d+\s*分/.test(feedback), `${v.code}: 账户前后值可见`);
      await leaveFeedback(i === day1.total - 1);
    }
  });

  await scenario('day1-completion-unlocks-day2-and-clears-run', async () => {
    await wait(`document.querySelector('.mode-card.strict')`, 'mode choice after last visitor');
    assert(await current.eval(`/D01/.test(document.body.innerText)`), '结算层标注当前关卡');
    await click('.mode-card.strict');
    await wait(`document.querySelector('.result')`, 'result screen');
    const text = await bodyText();
    assert(text.includes(`${day1.total}`), '结算展示本局人数', day1.total);
    for (const zh of ['判定正确', '判定错误', '开档次数', '误放行', '误拒绝', '总分', '预算结余']) {
      assert(text.includes(zh), `结算层中文可见：${zh}`);
    }
    assert(text.includes('SHIFT REPORT'), '结算层英文锚点仍在');
    const meta = await metaState();
    assert(meta?.schema === 3, 'meta 已升级到 v3', meta?.schema);
    assert((meta?.bestByDay?.D01 ?? 0) !== 0, '按日最高分已记录', meta?.bestByDay);
    assert(meta?.bestScore >= meta.bestByDay.D01, '总最高分不低于单日最高分');
    assert(meta?.unlockedDay === 'D02', '通关 D01 解锁 D02', meta?.unlockedDay);
    assert(await current.eval(`localStorage.getItem(${JSON.stringify(RUN_KEY)})===null`), '通关后清空可续玩存档');
    await clickText('BACK TO MENU');
    await wait(`document.querySelector('.day-pick')`, 'home day picker');
    assert(await current.eval(`!Array.from(document.querySelectorAll('.day-pick button')).find(b=>b.innerText.includes('D02'))?.disabled`), '首页 D02 已可点');
    assert(await current.eval(`Array.from(document.querySelectorAll('.day-pick button')).find(b=>b.innerText.includes('D03'))?.disabled === true`), '首页 D03 仍锁定');
  });

  await scenario('day2-broadcasts-lock-and-survive-refresh', async () => {
    await page({ query: `?day=D02&seed=${day2.seed}` });
    await wait(`document.querySelector('.actionbar')`, 'day2 launch');
    assert((await runState())?.total === day2.total, 'D02 是 10 人班次', (await runState())?.total);
    for (let i = 0; i < day2.total; i += 1) {
      const v = day2.visitors[i];
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `day2 visitor ${v.code}`);
      for (const update of day2.updates.filter((u) => u.atIndex === i)) await ackToast(update.atIndex);
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `day2 visitor ${v.code} after ACK`);
      await judge(v.correct);
      await leaveFeedback(i === day2.total - 1);
    }
    await wait(`document.querySelector('.mode-card.strict')`, 'day2 verdict');
  });

  await scenario('inspect-fee-once-and-clue-reveal', async () => {
    await page({ query: `?day=D02&seed=${day2.seed + 1}` });
    const seeded = fixtureRun('D02', day2.seed + 1);
    await wait(`document.querySelector('.actionbar')`, 'launch for inspect');
    const before = await runState();
    await click('.btn-inspect');
    await persisted('s=>s?.inspected===true', 'INSPECT persisted');
    const paid = await runState();
    assert(paid.funds === before.funds - 25, 'INSPECT 只扣 ¥25', { before: before.funds, paid: paid.funds });
    assert(paid.inspectedCount === before.inspectedCount + 1, 'INSPECT 只计一次');
    const deep = await current.eval(`document.querySelector('.deep-panel')?.innerText ?? ''`);
    for (const clue of seeded.visitors[0].hiddenClues) assert(deep.includes(clue), '开档后线索可见', clue);
    assert(!deep.includes('SEALED') && !deep.includes('未开档'), '开档后档案解封（中英双证）');
    await shot('inspect-open');
    await reloadResume();
    const after = await runState();
    assert(after.funds === paid.funds && after.inspectedCount === paid.inspectedCount, '刷新后不重复扣费');
    assert(await current.eval(`document.querySelector('.btn-inspect')?.disabled`), '刷新后 INSPECT 仍禁用');
    assert((await current.eval(`document.querySelector('.deep-panel')?.innerText ?? ''`)).includes(seeded.visitors[0].hiddenClues[0]), '刷新后开档结果仍在');
  });

  await scenario('legacy-v2-save-migrates-into-d00', async () => {
    const legacy = { index: 4, score: 320, funds: 715, inspectedCount: 2, inspected: false, records: [], seenUpdates: [3], pendingUpdate: null, phase: 'playing', lastRecord: null };
    await page({ legacy, meta: { bestScore: 640 } });
    await wait(`Array.from(document.querySelectorAll('button')).some(b=>/RESUME/.test(b.innerText))`, 'legacy resume offered');
    const resumeText = await current.eval(`Array.from(document.querySelectorAll('button')).find(b=>/RESUME/.test(b.innerText)).innerText`);
    assert(/05\s*\/\s*10/.test(resumeText), '旧档续玩进度 05/10 保留', resumeText);
    await clickText('RESUME');
    await wait(`document.querySelector('.actionbar')`, 'legacy resumed');
    assert(await current.eval(`document.body.innerText.includes('V-005')`), '迁移后停在第 5 位访客');
    const state = await runState();
    assert(state?.day === 'D00' && state?.total === 10, '迁移成 D00 一局', { day: state?.day, total: state?.total });
    assert(state?.score === 320 && state?.funds === 715, '旧档分数与预算不丢', { score: state?.score, funds: state?.funds });
    assert(await current.eval(`localStorage.getItem(${JSON.stringify(LEGACY_RUN)})!==null`), '旧键保留（回滚安全）');
    assert((await metaState())?.bestScore === 640, '旧最高分保留', (await metaState())?.bestScore);
    await shot('legacy-resumed');
  });

  await scenario('locked-days-and-per-day-best-score', async () => {
    await page({ meta: { unlockedDay: 'D01', bestByDay: { D01: 300 } } });
    await wait(`document.querySelector('.day-pick')`, 'home picker');
    const labels = await current.eval(`Array.from(document.querySelectorAll('.day-pick button')).map(b=>({text:b.innerText, disabled:b.disabled}))`);
    // 第十轮：D04 上线后关卡数由 3 → 4，断言同步改为「展现四天」并补锁定位检查（只增不减）
    assert(labels.length === 4, '首页展示四天（D01–D04）', labels.length);
    assert(labels[1].disabled === true && labels[2].disabled === true && labels[3].disabled === true, '未解锁的三天不可点', labels);
    assert(/BEST\s*300/.test(labels[0].text), '已通关日展示最好成绩', labels[0].text);
    assert((await bodyText()).includes('8'), '首页给出当日人数');
  });

  await scenario('storage-setitem-failure-visible-no-white-screen', async () => {
    await page({ query: `?day=D01&seed=${SEED}`, storageFault: 'setItem' });
    await wait(`document.querySelector('.actionbar')`, 'game despite write failure');
    await wait(`Array.from(document.querySelectorAll('[role="alert"],[role="status"],.storage-warning,.storage-notice')).some(e=>e.getClientRects().length && /存储|存档|保存|storage|进度/i.test(e.innerText))`, 'visible storage failure notice');
    await click('.actionbar .btn-approve');
    await wait(`document.querySelector('.feedback')`, 'review still possible');
    assert(await current.eval(`document.querySelector('.shell').innerText.length>50 && document.querySelectorAll('button').length>0`), '写失败时应用仍可用');
    await shot('storage-notice');
  });

  await scenario('d03-320px-no-horizontal-overflow', async () => {
    await page({ v3: savedShape(day3, 0), meta: { unlockedDay: 'D03' }, width: 320, height: 568 });
    await reloadResume();
    await wait(`document.querySelector('.actionbar')`, 'd03 at 320px');
    const metrics = await current.eval(`({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, actionbar: document.querySelector('.actionbar')?.getBoundingClientRect().bottom, height: window.innerHeight })`);
    assert(metrics.scrollWidth <= metrics.innerWidth + 1, '320px 无横向溢出', metrics);
    assert(metrics.actionbar <= metrics.height + 1, '操作栏在 320px 视口内可达', metrics);
    const overflow = await current.eval(`Array.from(document.querySelectorAll('.stage *')).filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && (r.right>window.innerWidth+1||r.left<-1)}).slice(0,4).map(e=>e.className||e.tagName)`);
    assert(!overflow.length, '320px 无越界元素', overflow);
    await shot('d03-320');
  });

  await scenario('dialogs-focus-trapped-and-restored', async () => {
    await page({ meta: { unlockedDay: 'D01' } });
    await wait(`document.querySelector('.home-buttons')`, 'home');
    await clickText('VIEW HOW TO PLAY');
    await modalFocus('[role="dialog"]', '[data-v3-probe="1"]');
    await clickText('START GAME');
    await wait(`document.querySelector('.actionbar')`, 'game start for drawer');
    await click('.rule-toggle');
    await modalFocus('.drawer', '.rule-toggle');
  });

  await scenario('d03-no-answer-leak-across-full-day', async () => {
    await page({ v3: savedShape(day3, 0), meta: { unlockedDay: 'D03' } });
    await reloadResume();
    for (let i = 0; i < day3.total; i += 1) {
      const v = day3.visitors[i];
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `d03 visitor ${v.code}`);
      const text = await bodyText();
      assert(!text.includes(v.explanation), `${v.code}: 判定前无解释`);
      for (const clue of v.hiddenClues) assert(!text.includes(clue), `${v.code}: 判定前无开档线索`);
      for (const update of day3.updates.filter((u) => u.atIndex === i)) await ackToast(update.atIndex);
      await wait(`document.body.innerText.includes(${JSON.stringify(v.code)})`, `d03 visitor ${v.code} after ACK`);
      await judge(v.correct);
      await leaveFeedback(i === day3.total - 1);
    }
    await wait(`document.querySelector('.mode-card.strict')`, 'd03 verdict');
  });


  // ---------- 第九轮新增场景（§4.4） ----------

  await scenario('home-copy-matches-rule-count', async () => {
    await page({ meta: { unlockedDay: 'D03' } });
    await wait(`document.querySelector('.home-buttons')`, 'home for rule copy');
    const d03 = await bodyText();
    assert(/12\s*位访客/.test(d03), 'D03 首页给出 12 位访客', d03.slice(0, 90));
    assert(/7\s*条规则/.test(d03), 'D03 首页规则数为 7', d03.slice(0, 90));
    assert(!d03.includes('七条规则'), '不再出现写死的「七条规则」');
    await clickText('D01');
    await wait(`/8\\s*位访客/.test(document.body.innerText)`, 'home switched to D01');
    const d01 = await bodyText();
    assert(/6\s*条规则/.test(d01), '切到 D01 后规则数变为 6', d01.slice(0, 90));
    assert(!/12\s*位访客/.test(d01), '切换关卡后人数文案同步更新');
    await shot('home-rule-count');
  });

  await scenario('progressbar-exposes-position', async () => {
    await page({ query: `?day=D01&seed=${SEED}` });
    await wait(`document.querySelector('.actionbar')`, 'progressbar launch');
    const before = await current.eval(`(() => { const e=document.querySelector('.stat-progress'); return e && { role:e.getAttribute('role'), min:e.getAttribute('aria-valuemin'), max:e.getAttribute('aria-valuemax'), now:e.getAttribute('aria-valuenow'), text:e.getAttribute('aria-valuetext'), selfHidden:e.getAttribute('aria-hidden'), trackHidden:document.querySelector('.pip-track')?.getAttribute('aria-hidden') }; })()`);
    assert(before?.role === 'progressbar', '进度条暴露 role=progressbar', before);
    assert(before.min === '0' && before.max === String(day1.total), 'aria-valuemin/max 对齐 0..N', before);
    assert(before.now === '0', '未判定时 aria-valuenow=0', before);
    assert(/共\s*8\s*位/.test(before.text || ''), 'aria-valuetext 含「共 8 位」', before.text);
    assert(before.selfHidden === null, '.stat-progress 自身不再 aria-hidden', before);
    assert(before.trackHidden === 'true', '.pip-track 仍 aria-hidden（视觉轨道）', before);
    for (const update of day1.updates.filter((u) => u.atIndex === 0)) await ackToast(update.atIndex);
    await judge(day1.visitors[0].correct);
    const after = await current.eval(`document.querySelector('.stat-progress')?.getAttribute('aria-valuenow')`);
    assert(after === '1', '判定一位后 aria-valuenow=1', after);
    const afterText = await current.eval(`document.querySelector('.stat-progress')?.getAttribute('aria-valuetext') ?? ''`);
    assert(/已判\s*1\s*位/.test(afterText), 'aria-valuetext 同步已判位数', afterText);
    await shot('progressbar-after-one');
  });

  await scenario('stamp-wait-bounded', async () => {
    await page({ query: `?day=D01&seed=${SEED}` });
    await wait(`document.querySelector('.actionbar')`, 'stamp launch');
    const stampTimed = async (label, code) => {
      // 等新访客及其信号面板渲染稳定再取样，否则布局位移会让点击落空
      await wait(`document.body.innerText.includes(${JSON.stringify(code)})`, `${label}: visitor ${code} rendered`);
      await sleep(150);
      await click('.pp-open');
      await wait(`document.querySelector('.ppz-stamp-row') && document.querySelector('.pp-overlay')?.contains(document.activeElement)`, `${label}: passport zoom focused`);
      const t0 = Date.now();
      await click('.ppz-stamp-row .btn-approve');
      await wait(`document.querySelector('.feedback')`, `${label}: feedback after stamp`);
      const ms = Date.now() - t0;
      await leaveFeedback(false);
      return ms;
    };
    await current.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    const reducedMs = await stampTimed('reduced-motion', day1.visitors[0].code);
    assert(reducedMs < 260, 'reduced-motion 下盖章等待≈0ms（<260ms）', reducedMs);
    await current.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    const normalMs = await stampTimed('default', day1.visitors[1].code);
    assert(normalMs >= 280 && normalMs <= 700, '默认盖章等待约 340ms（280–700ms）', normalMs);
  });

  await scenario('scoring-table-first-two-only', async () => {
    await page({ query: `?day=D01&seed=${SEED}` });
    await wait(`document.querySelector('.actionbar')`, 'scoring table launch');
    for (let i = 0; i < 3; i += 1) {
      for (const update of day1.updates.filter((u) => u.atIndex === i)) await ackToast(update.atIndex);
      await judge(day1.visitors[i].correct);
      const text = await current.eval(`document.querySelector('.feedback')?.innerText ?? ''`);
      if (i < 2) assert(text.includes('SCORING TABLE'), `第 ${i + 1} 位反馈保留计分表`);
      else {
        assert(!text.includes('SCORING TABLE'), `第 ${i + 1} 位反馈不再重复计分表`);
        assert(!text.includes('计分表'), `第 ${i + 1} 位反馈中文计分表也不再出现`);
      }
      await leaveFeedback(false);
    }
  });

  await scenario('touch-target-min-40', async () => {
    const measure = (selectors) => current.eval(`(() => { const out=[]; for (const sel of ${JSON.stringify(selectors)}) for (const e of document.querySelectorAll(sel)) { const r=e.getBoundingClientRect(); if (r.height>0) out.push({ sel, h: Math.round(r.height*10)/10 }); } return out; })()`);
    await page({ meta: { unlockedDay: 'D02' } });
    await wait(`document.querySelector('.home-buttons')`, 'touch targets on home');
    for (const t of await measure(['.day-pick button', '.home-buttons .btn'])) assert(t.h >= 40, `首页触控目标 ≥40：${t.sel}`, t);
    await clickText('START GAME');
    await wait(`document.querySelector('.actionbar')`, 'touch targets in game');
    for (const t of await measure(['.actionbar .btn', '.pp-open', '.pp-portrait', '.pp-slots'])) assert(t.h >= 40, `游戏内触控目标 ≥40：${t.sel}`, t);
    const at = day2.updates[0].atIndex;
    await page({ v3: savedShape(day2, at), meta: { unlockedDay: 'D02' } });
    await reloadResume();
    await wait(`document.querySelector('.toast-wrap')`, 'toast for touch target');
    for (const t of await measure(['.toast .t-action'])) assert(t.h >= 40, `toast 操作按钮 ≥40：${t.sel}`, t);
    await shot('touch-targets');
  });

  await scenario('zoom-enabled', async () => {
    await page({ meta: { unlockedDay: 'D01' } });
    await wait(`document.querySelector('.home-buttons')`, 'home for viewport check');
    const content = await current.eval(`document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''`);
    assert(/width=device-width/.test(content), 'viewport 保留 width=device-width', content);
    assert(!/maximum-scale/i.test(content), 'viewport 不再限制 maximum-scale', content);
    assert(!/user-scalable/i.test(content), 'viewport 不再禁止 user-scalable', content);
    assert(!/touch-action:\s*none/.test(String(await current.eval(`getComputedStyle(document.body).touchAction`))), 'body 未禁用触控手势');
  });

  await scenario('display-change-no-answer-leak', async () => {
    await page({ v3: savedShape(day1, 0), meta: { unlockedDay: 'D01' } });
    await reloadResume();
    await sleep(250);
    const v = day1.visitors[0];
    const noLeak = async (label) => {
      const text = await bodyText();
      assert(!text.includes(v.explanation), `${label}: DOM 不含判定解释`, v.explanation.slice(0, 16));
      for (const clue of v.hiddenClues) assert(!text.includes(clue), `${label}: DOM 不含开档线索`);
      assert(
        !/VERDICT (ACCEPTED|REJECTED)/.test(text) && !/判定正确|判定错误/.test(text),
        `${label}: DOM 不含审计结论（中英双证）`,
      );
    };
    await noLeak('初始');
    await click('.pp-open');
    await wait(`document.querySelector('.pp-overlay')`, 'passport zoom open');
    await noLeak('护照放大层打开');
    await click('.ppz-head .tag.dim');
    await wait(`!document.querySelector('.pp-overlay')`, 'passport zoom closed');
    await noLeak('护照放大层关闭');
    await click('.rule-toggle');
    await wait(`document.querySelector('.drawer')`, 'rule drawer open');
    await noLeak('规则抽屉打开');
    await click('.drawer .sheet-head .tag.dim');
    await wait(`!document.querySelector('.drawer')`, 'rule drawer closed');
    await current.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 568, deviceScaleFactor: 1, mobile: false });
    await sleep(150);
    await noLeak('视口收窄到 320');
    await current.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    await sleep(150);
    await noLeak('视口恢复');
    await judge(v.correct);
    const feedback = await current.eval(`document.querySelector('.feedback')?.innerText ?? ''`);
    assert(feedback.includes(v.explanation), '判定之后才在反馈层揭示解释');
  });

  await scenario('round9-visual-and-live-region-contracts', async () => {
    const idx = day3.visitors.findIndex((x, i) => x.signals.length > 0 && !day3.updates.some((u) => u.atIndex === i));
    if (idx < 0) throw new Error('D03 fixture 中没有「带信号且无广播」的访客');
    await page({ v3: savedShape(day3, idx), meta: { unlockedDay: 'D03' }, width: 320, height: 568 });
    await reloadResume();
    const signals = await current.eval(`Array.from(document.querySelectorAll('.signal')).map(e=>({ level: e.className.replace('signal','').trim(), label: e.querySelector('.sig-level')?.innerText ?? '' }))`);
    assert(signals.length > 0, '该访客渲染了信号卡', signals);
    for (const s of signals) {
      const expected = s.level.toUpperCase();
      assert(['ALERT', 'WARN', 'INFO'].includes(expected), '信号 class 是合法等级', s);
      assert(s.label === expected, '信号卡文本含 ALERT/WARN/INFO', s);
    }
    const tier = await current.eval(`(() => { const e=document.querySelector('.pp-tier'); if(!e) return null; const r=e.getBoundingClientRect(); return { display: getComputedStyle(e).display, h: r.height, text: e.innerText }; })()`);
    assert(tier && tier.display !== 'none' && tier.h > 0, '320 宽下 .pp-tier 不再整体隐藏', tier);
    await judge(day3.visitors[idx].correct);
    const sub = await current.eval(`(() => { const e=document.querySelector('.stamp-sub'); if(!e) return null; const s=getComputedStyle(e); return { size: s.fontSize, color: s.color }; })()`);
    assert(sub?.size === '11px', '.stamp-sub 字号 11px', sub);
    assert(sub?.color === 'rgb(134, 152, 179)', '.stamp-sub 用 --ink-dim rgb(134,152,179)', sub);
    const live = await current.eval(`(() => { const e=document.querySelector('.sr-only[aria-live="polite"]'); return e ? { role: e.getAttribute('role'), text: e.innerText } : null; })()`);
    assert(live?.role === 'status' && /判定/.test(live.text), '判定结果通过 aria-live=polite 播报', live);
    await shot('round9-contracts-320');
  });

  await scenario('bilingual-controls-keep-both-layers', async () => {
    await page({ query: `?day=D01&seed=${day1.seed}` });
    await wait(`document.querySelector('.actionbar')`, 'bilingual launch');
    // 关键控件必须「中文可读 + 英文锚点」并存：删掉任一层都会在这里报错
    for (const [sel, en] of [
      ['.actionbar .btn-inspect', 'INSPECT'],
      ['.actionbar .btn-deny', 'DENY'],
      ['.actionbar .btn-approve', 'APPROVE'],
      ['.pp-open', 'PASSPORT'],
    ]) {
      const t = await current.eval(`document.querySelector(${JSON.stringify(sel)})?.innerText ?? ''`);
      assert(/[\u4e00-\u9fa5]/.test(t), `${sel}: 中文可读`, t);
      assert(t.includes(en), `${sel}: 英文锚点仍在`, t);
    }
    const bar = await bodyText();
    for (const zh of ['访客', '预算', '分数']) assert(bar.includes(zh), `状态栏已汉化：${zh}`);
    assert(bar.includes('RULES OF THE DAY'), '规则入口英文锚点仍在');
    await current.eval(`document.querySelector('.rule-toggle').click()`);
    await wait(`document.querySelector('.drawer')`, 'bilingual drawer');
    const drawer = await current.eval(`document.querySelector('.drawer')?.innerText ?? ''`);
    assert(drawer.includes('RULES OF THE DAY'), '抽屉标题英文锚点仍在');
    assert(/关闭/.test(drawer), '抽屉关闭按钮已汉化');
    for (const zh of ['代码', '地区', '时区', '语言', '状态']) assert(drawer.includes(zh), `注册表表头已汉化：${zh}`);
    await current.eval(`document.querySelector('.drawer .sheet-head button').click()`);
    await wait(`!document.querySelector('.drawer')`, 'bilingual drawer closed');
    // 保存进度后仍必须能按 START GAME（英文锚点不得条件渲染）
    await sleep(150);
    await page({ meta: { unlockedDay: 'D01' }, v3: savedShape(day1, 2) });
    await wait(`document.querySelector('.home-buttons')`, 'home with save');
    const home = await bodyText();
    assert(home.includes('START GAME'), '有存档时 START GAME 锚点仍在');
    assert(home.includes('RESUME'), '有存档时 RESUME 锚点仍在');
    assert(/第 03\s*\/\s*8 位/.test(home), '续玩进度数字相邻可读', home.slice(0, 120));
  });

  await scenario('day4-ladder-extends', async () => {
    await page({ meta: { unlockedDay: 'D04' } });
    await wait(`document.querySelector('.home-buttons')`, 'home for D04');
    const chips = await current.eval(`Array.from(document.querySelectorAll('.day-pick button')).map((b) => b.getAttribute('aria-label') || b.innerText)`);
    assert(chips.length === 4, '首页出现 4 个关卡按钮（D01–D04）', chips);
    assert(chips.every((c) => /D0[1-4]/.test(String(c))), '四个关卡分别是 D01–D04', chips);
    await clickText('D01');
    await wait(`document.body.innerText.includes('8 位访客')`, 'home switched to D01');
    await sleep(120);
    const d01Home = await bodyText();
    assert(/8 位访客/.test(d01Home) && /6 条规则/.test(d01Home), '切回 D01 仍是 8 位 / 6 条', d01Home.slice(0, 90));
    await clickText('D04');
    await wait(`document.body.innerText.includes('16 位访客')`, 'home switched to D04');
    await sleep(120);
    const home = await bodyText();
    assert(/16 位访客/.test(home), 'D04 首屏为 16 位访客', home.slice(0, 90));
    assert(/7 条规则/.test(home), 'D04 首屏 7 条规则（R06 / R07 两次上线）', home.slice(0, 90));
    await shot('day4-home');

    await page({ query: `?day=D04&seed=${SEED}` });
    await wait(`document.querySelector('.actionbar')`, 'D04 launch');
    const bar = await current.eval(`(() => { const e=document.querySelector('.stat-progress'); return e && { max:e.getAttribute('aria-valuemax'), text:e.getAttribute('aria-valuetext'), pips:document.querySelectorAll('.pip-track .pip').length }; })()`);
    assert(bar?.max === '16', 'D04 进度条 max=16', bar);
    assert(bar.pips === 16, 'D04 进度条渲染 16 个 pip', bar.pips);
    assert(/共\s*16\s*位/.test(bar.text || ''), 'D04 aria-valuetext 含「共 16 位」', bar.text);
    const visible = await bodyText();
    assert(/RULES OF THE DAY/.test(visible), 'D04 局内渲染当日规则区', visible.slice(0, 90));
    await judge(day4.visitors[0].correct);
    const after = await current.eval(`document.querySelector('.stat-progress')?.getAttribute('aria-valuenow')`);
    assert(after === '1', 'D04 判定第一位后进度同步', after);
    await shot('day4-in-run');
  });

  assert(report.runtimeErrors.length === 0, 'no uncaught browser runtime exceptions', report.runtimeErrors);
  exit = report.scenarios.every((s) => s.pass) && report.assertions.every((a) => a.pass) ? 0 : 1;
} catch (error) {
  report.harnessError = String(error.stack || error);
  console.error(report.harnessError);
  exit = report.harnessError.includes('ASSERTION:') ? 1 : 2;
} finally {
  report.finishedAt = new Date().toISOString();
  report.status = exit === 0 ? 'PASS' : exit === 1 ? 'FAIL' : 'HARNESS_ERROR';
  report.exitCode = exit;
  report.summary = { scenarios: report.scenarios.length, passed: report.scenarios.filter((s) => s.pass).length, assertions: report.assertions.length, failedAssertions: report.assertions.filter((a) => !a.pass).length };
  for (const c of clients) c.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => chrome.once('exit', resolve)), sleep(2000)]);
    if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await new Promise((resolve) => chrome.once('exit', resolve)); }
  }
  if (profile && path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('ai-please-v3-chrome-')) {
    await rm(profile, { recursive: true, force: true }).catch((e) => { report.cleanupError = String(e); });
  }
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, 'test-results.json'), JSON.stringify(report, null, 2));
  console.log(`${report.status}: ${report.summary.passed}/${report.summary.scenarios} scenarios; ${report.summary.assertions} assertions; evidence: ${out}`);
  process.exitCode = exit;
}
