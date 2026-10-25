#!/usr/bin/env node
/**
 * 双语注释层视觉探针（320 / 390 两档，真实点击 + 截图）。
 *
 * 验收脚本只覆盖两处 320 截图，规则抽屉 / 反馈层 / 护照放大页在大屏下拍不到。
 * 这里补齐证据：中文副注是否单行、是否溢出父容器、页面是否横向滚动。
 *
 * Usage: node --experimental-strip-types scripts/probe-zh.mjs --url http://127.0.0.1:4175/ai-please/
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i += 2) opts[argv[i].slice(2)] = argv[i + 1];
const url = new URL(opts.url || 'http://127.0.0.1:4175/ai-please/');
const out = path.resolve(opts.out || '/tmp/ai-please-zh-probe');
const chromePath =
  opts.chrome ||
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : process.env.CHROME_PATH || 'google-chrome');
const META_KEY = 'ai-please:meta:v3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome, profile, current, shotId = 0;
const findings = [];

class CDP {
  constructor(ws) {
    this.ws = ws; this.seq = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(String(e.data));
      const p = this.pending.get(m.id);
      if (!p) return;
      clearTimeout(p.timer); this.pending.delete(m.id);
      m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    });
  }
  static async open(endpoint) {
    const ws = new WebSocket(endpoint);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new CDP(ws);
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
    if (r.exceptionDetails) throw new Error(`eval: ${JSON.stringify(r.exceptionDetails)}`);
    return r.result.value;
  }
  close() { this.ws.close(); }
}

async function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

async function measure(label) {
  const data = await current.eval(`(() => {
    const docOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const docOverflowY = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const rows = [];
    const seen = new Set();
    for (const e of document.querySelectorAll('.bi-zh,.bi-line,.bi-en,.cn,.delta,.stamp,.result-cell .k,.stat-label')) {
      const r = e.getBoundingClientRect();
      if (!r.width || getComputedStyle(e).display === 'none') continue;
      const p = e.parentElement.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      // 行数必须扣掉 padding/border：印章这类带 10px 内边距的块，用外框高度会误判成两行
      // getBoundingClientRect 永远返回边框盒，所以内边距/边框无条件扣掉
      const box =
        parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
        parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      const contentH = Math.max(0, r.height - box);
      const key = e.className + '|' + e.innerText.trim();
      if (seen.has(key)) continue; seen.add(key);
      rows.push({
        cls: e.className,
        text: e.innerText.trim().slice(0, 28),
        lines: Math.max(1, Math.round(contentH / lh)),
        overflowRight: Math.round(r.right - p.right),
        overflowLeft: Math.round(p.left - r.left),
        fontSize: cs.fontSize,
      });
    }
    return { docOverflow, docOverflowY, rows, bodyCH: document.body.clientHeight, bodySH: document.body.scrollHeight };
  })()`);
  const bad = data.rows.filter((r) => r.lines > 1 || r.overflowRight > 1 || r.overflowLeft > 1);
  findings.push({ label, at320: data, multiLineOrOverflow: bad });
  return data;
}

async function shot(label) {
  const s = await current.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const name = `${String(++shotId).padStart(2, '0')}-${label}.png`;
  await writeFile(path.join(out, name), Buffer.from(s.data, 'base64'));
  return name;
}

async function wait(expr, label, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await current.eval(`!!(${expr})`)) return true;
    await sleep(70);
  }
  throw new Error(`Timeout: ${label}`);
}

async function clickText(text) {
  const pos = await current.eval(`(() => {
    const e = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.includes(${JSON.stringify(text)}));
    if (!e) throw new Error('missing button ' + ${JSON.stringify(text)});
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
    await current.send('Input.dispatchMouseEvent', { type, x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  }
}

async function openViewport(width, height) {
  if (current) { await current.send('Page.close').catch(() => {}); current.close(); }
  const target = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
  current = await CDP.open(target.webSocketDebuggerUrl);
  await current.send('Page.enable');
  await current.send('Runtime.enable');
  await current.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await current.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const meta = JSON.stringify({ schema: 3, tutorialSeen: true, muted: true, bestScore: 0, bestByDay: {}, unlockedDay: 'D01' });
  await current.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.clear(); localStorage.setItem(${JSON.stringify(META_KEY)}, ${JSON.stringify(meta)});`,
  });
  const dest = new URL(url);
  dest.searchParams.set('probe', String(Date.now()));
  await current.send('Page.navigate', { url: dest.href });
  await wait(`document.querySelector('.home-buttons')`, 'home');
  await sleep(150);
}

let port, exit = 2;
try {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  port = await freePort();
  profile = await mkdtemp(path.join(tmpdir(), 'ai-please-zh-probe-'));
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  for (let i = 0; i < 100; i += 1) {
    try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(100); }
  }

  for (const [w, h] of [[320, 568], [390, 844]]) {
    const tag = `${w}x${h}`;
    await openViewport(w, h);
    await shot(`${tag}-01-home`);
    await measure(`${tag}-home`);

    // 玩法说明（首次进入自动弹出，也是「最开始的规则说明」）：第 1 步与第 3 步各拍一张
    await clickText('VIEW HOW TO PLAY');
    await wait(`document.querySelector('.sheet-foot .btn-wide')`, 'tutorial');
    await sleep(200);
    await shot(`${tag}-10-tutorial-1`);
    await measure(`${tag}-tutorial-1`);
    await current.eval(`document.querySelector('.sheet-foot .btn-wide').click()`);
    await sleep(120);
    await current.eval(`document.querySelector('.sheet-foot .btn-wide').click()`);
    await sleep(200);
    await shot(`${tag}-11-tutorial-3`);
    await measure(`${tag}-tutorial-3`);
    await clickText('跳过说明');
    await wait(`!document.querySelector('.sheet-foot .btn-wide')`, 'tutorial closed');

    await clickText('START GAME');
    await wait(`document.querySelector('.actionbar')`, 'game');
    await sleep(200);
    await shot(`${tag}-02-game`);
    await measure(`${tag}-game`);

    await current.eval(`document.querySelector('.rule-toggle').click()`);
    await wait(`document.querySelector('.drawer')`, 'drawer');
    await sleep(200);
    await shot(`${tag}-03-drawer`);
    await measure(`${tag}-drawer`);

    // 规则抽屉下半部分：开放区注册表（状态列已汉化）
    await current.eval(`(() => { const b = document.querySelector('.drawer .sheet-body'); if (b) b.scrollTop = b.scrollHeight; })()`);
    await sleep(200);
    await shot(`${tag}-03b-drawer-registry`);
    await measure(`${tag}-03b-drawer-registry`);
    await current.eval(`(() => { const b = document.querySelector('.drawer .sheet-body'); if (b) b.scrollTop = 0; })()`);
    await current.eval(`document.querySelector('.drawer .sheet-head button').click()`);
    await wait(`!document.querySelector('.drawer')`, 'drawer closed');

    await current.eval(`document.querySelector('.pp-open').click()`);
    await wait(`document.querySelector('.ppz-stamp-row')`, 'passport zoom');
    await sleep(250);
    await shot(`${tag}-04-zoom`);
    await measure(`${tag}-zoom`);
    await current.eval(`document.querySelector('.ppz-head .tag.dim').click()`);
    await wait(`!document.querySelector('.pp-overlay')`, 'zoom closed');

    await current.eval(`document.querySelector('.btn-approve').click()`);
    await wait(`document.querySelector('.feedback')`, 'feedback');
    await sleep(500);
    await shot(`${tag}-05-feedback`);
    await measure(`${tag}-feedback`);
  }

  // 场景 3：整班跑到结算层（规则/反馈/复盘的中文注释在流程里才出现，单页探针拍不到）
  let sceneError = null;
  let wrongVerdictSeen = false;
  try {
    await openViewport(320, 568);
    await clickText('START GAME');
    await wait(`document.querySelector('.actionbar')`, 'game');
    for (let i = 0; i < 8; i += 1) {
      if (await current.eval(`!!document.querySelector('.toast-wrap')`)) {
        await shot('320x568-06-toast');
        await measure('320x568-toast');
        await clickText('ACKNOWLEDGE');
        await wait(`!document.querySelector('.toast-wrap')`, 'toast ack');
      }
      await current.eval(`document.querySelector('.actionbar .btn-approve').click()`);
      await wait(`document.querySelector('.feedback')`, 'feedback');
      const verdict = await current.eval(
        `document.querySelector('.feedback .stamp')?.dataset.verdict ?? ''`,
      );
      if (verdict === 'wrong' && !wrongVerdictSeen) {
        wrongVerdictSeen = true;
        await sleep(400);
        await shot('320x568-09-feedback-wrong');
        await measure('320x568-feedback-wrong');
      }
      await clickText(i === 7 ? 'PROCEED TO DEBRIEF' : 'NEXT VISITOR');
      await wait(`!document.querySelector('.feedback')`, 'feedback closed');
    }
    await wait(`document.querySelector('.mode-card.strict')`, 'mode choice');
    await sleep(300);
    await shot('320x568-07-mode');
    await measure('320x568-mode');
    await current.eval(`document.querySelector('.mode-card.strict').click()`);
    await wait(`document.querySelector('.result')`, 'result');
    await sleep(600);
    await shot('320x568-08-result');
    await measure('320x568-result');
  } catch (error) {
    sceneError = String(error.message || error);
  }

  const bad = findings.flatMap((f) => f.multiLineOrOverflow.map((r) => ({ at: f.label, ...r })));
  const docs = findings.map((f) => ({ at: f.label, docOverflow: f.at320.docOverflow, docOverflowY: f.at320.docOverflowY }));
  const spans = findings.reduce((n, f) => n + f.at320.rows.length, 0);
  const MIN_SPANS = 90;
  await writeFile(
    path.join(out, 'probe.json'),
    JSON.stringify({ findings, bad, sceneError, spans, wrongVerdictSeen }, null, 2),
  );
  console.log(JSON.stringify({ bad, sceneError, docs, spans, wrongVerdictSeen, minSpans: MIN_SPANS }, null, 2));
  if (spans < MIN_SPANS) {
    console.error(`probe: 只测到 ${spans} 个中文节点（下限 ${MIN_SPANS}），疑似选择器或渲染退化`);
  }
  exit = bad.length === 0 && !sceneError && spans >= MIN_SPANS ? 0 : 1;
} catch (error) {
  console.error(error.stack || String(error));
  exit = 2;
} finally {
  if (current) current.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill('SIGTERM');
    await Promise.race([new Promise((r) => chrome.once('exit', r)), sleep(1500)]);
    if (chrome.exitCode === null) chrome.kill('SIGKILL');
  }
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
  console.log(`probe exit=${exit}; evidence: ${out}`);
  process.exitCode = exit;
}
