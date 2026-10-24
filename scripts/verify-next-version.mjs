#!/usr/bin/env node
/**
 * Independent next-version acceptance. Node >=22, Chrome, no npm dependencies.
 * Usage: node scripts/verify-next-version.mjs --url http://127.0.0.1:4173
 * Optional: --chrome /absolute/path/to/chrome --out /tmp/ai-please-next-evidence
 * Starts ONLY an isolated headless Chrome, never an app server or deployment.
 * Synthetic localStorage belongs to the fresh profile; no existing profiles,
 * cookies, credentials, environment secrets or historical reports are read.
 * Exit 0 = all listed assertions passed on this run; 1 = failures; 2 = harness error.
 * A passing report is evidence, not a production-readiness certification.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const argv = process.argv.slice(2);
if (argv.includes('--help')) {
  console.log('node scripts/verify-next-version.mjs --url http://127.0.0.1:4173 [--chrome PATH] [--out DIR]\nRequires Node >=22 and Chrome. Creates isolated browser data and JSON/PNG evidence. Does not start or modify the app.');
  process.exit(0);
}
const opts = {};
for (let i = 0; i < argv.length; i += 2) {
  if (!['--url', '--chrome', '--out'].includes(argv[i]) || !argv[i + 1]) throw new Error(`Invalid argument: ${argv[i]}`);
  opts[argv[i].slice(2)] = argv[i + 1];
}
const url = new URL(opts.url || 'http://127.0.0.1:4173');
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP(S) URL without credentials');
const out = path.resolve(opts.out || path.join(tmpdir(), `ai-please-next-evidence-${Date.now()}`));
const chromePath = opts.chrome || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const RUN = 'ai-please:run:v2', META = 'ai-please:meta:v2';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { startedAt: new Date().toISOString(), url: url.href, viewport: { width: 1280, height: 900 }, assertions: [], scenarios: [], runtimeErrors: [], caveats: ['Synthetic checkpoint fixtures supplement real UI journeys; no backend exists.', 'Single Chromium desktop viewport, not full cross-browser/mobile/performance certification.'] };
let chrome, profile, current, exit = 2, shotId = 0;
const clients = new Set();
function assert(ok, name, actual) {
  report.assertions.push({ name, pass: Boolean(ok), actual });
  if (!ok) throw new Error(`ASSERTION: ${name}; actual=${JSON.stringify(actual)}`);
}
class CDP {
  constructor(ws) { this.ws = ws; this.seq = 0; this.pending = new Map(); ws.addEventListener('message', e => { const m = JSON.parse(String(e.data)); if (m.id) { const p = this.pending.get(m.id); if (!p) return; clearTimeout(p.timer); this.pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); } else if (m.method === 'Runtime.exceptionThrown') report.runtimeErrors.push({ scenario: report.scenarios.at(-1)?.name, detail: m.params.exceptionDetails }); }); }
  static async open(endpoint) { const ws = new WebSocket(endpoint); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); const c = new CDP(ws); clients.add(c); return c; }
  send(method, params = {}) { const id = ++this.seq; return new Promise((resolve, reject) => { const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000); this.pending.set(id, { resolve, reject, timer }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(`Browser evaluation: ${JSON.stringify(r.exceptionDetails)}`); return r.result.value; }
  close() { for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error('CDP closed')); } this.pending.clear(); this.ws.close(); clients.delete(this); }
}
let endpoint;
async function page({ fixture, storageFault } = {}) {
  if (current) { const old = current; current = null; await old.send('Page.close').catch(() => {}); old.close(); }
  const target = await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' }).then(r => r.json());
  current = await CDP.open(target.webSocketDebuggerUrl);
  await current.send('Page.enable'); await current.send('Runtime.enable'); await current.send('Network.enable');
  await current.send('Network.setCacheDisabled', { cacheDisabled: true });
  await current.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  // Install once per new target, BEFORE any app code executes. Reloads do not reseed.
  const source = `(() => {
    const nativeGet = Storage.prototype.getItem;
    if (!sessionStorage.getItem('next-version-seeded')) {
      localStorage.clear();
      localStorage.setItem(${JSON.stringify(META)}, JSON.stringify({tutorialSeen:true,bestScore:0,muted:true}));
      ${fixture ? `localStorage.setItem(${JSON.stringify(RUN)}, ${JSON.stringify(JSON.stringify(fixture))});` : ''}
      sessionStorage.setItem('next-version-seeded','1');
    }
    ${storageFault ? `Object.defineProperty(Storage.prototype, ${JSON.stringify(storageFault)}, { configurable: true, value: function(...args) { if(this === window.localStorage) throw new DOMException('NEXT_VERSION_INJECTED_STORAGE_FAILURE', '${storageFault === 'setItem' ? 'QuotaExceededError' : 'SecurityError'}'); return ${storageFault === 'getItem' ? 'nativeGet' : 'function(){}'}.apply(this,args); } });` : ''}
  })();`;
  await current.send('Page.addScriptToEvaluateOnNewDocument', { source });
  const dest = new URL(url); dest.searchParams.set('next_version_probe', String(Date.now()));
  await current.send('Page.navigate', { url: dest.href });
  await wait(`document.querySelector('.shell') && document.querySelector('.shell').innerText.length > 30`, 'app shell rendered');
}
async function wait(expression, label, timeout = 7000) {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) { last = await current.eval(`!!(${expression})`); if (last) return last; await sleep(80); }
  throw new Error(`Timeout: ${label}; last=${JSON.stringify(last)}`);
}
async function shot(label) { const name = `${String(++shotId).padStart(3, '0')}-${label.replace(/[^a-z0-9-]/gi, '-')}.png`; const s = await current.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); await writeFile(path.join(out, name), Buffer.from(s.data, 'base64')); report.scenarios.at(-1)?.screenshots.push(name); }
async function runState() { return current.eval(`JSON.parse(localStorage.getItem(${JSON.stringify(RUN)}))`); }
async function persisted(predicate, label) { return wait(`(${predicate})(JSON.parse(localStorage.getItem(${JSON.stringify(RUN)})))`, label); }
async function reloadResume() { await current.send('Page.reload', { ignoreCache: true }); await wait(`document.querySelector('.home-buttons')`, 'home after refresh'); await clickText('RESUME'); await wait(`document.querySelector('.actionbar')`, 'resume game'); }
async function click(selector) {
  const pos = await current.eval(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw Error('Missing '+${JSON.stringify(selector)}); e.scrollIntoView({block:'center'}); const r=e.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; const hit=document.elementFromPoint(x,y); return {x,y,disabled:!!e.disabled,hit:hit===e||e.contains(hit)}; })()`);
  assert(!pos.disabled && pos.hit, `real-click reachable: ${selector}`, pos);
  await current.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
  await current.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 1 });
}
async function clickText(text) {
  await wait(`Array.from(document.querySelectorAll('button')).some(e=>e.innerText.includes(${JSON.stringify(text)}))`, `button ${text}`);
  await current.eval(`(() => { document.querySelectorAll('[data-next-probe]').forEach(e=>e.removeAttribute('data-next-probe')); const e=Array.from(document.querySelectorAll('button')).find(e=>e.innerText.includes(${JSON.stringify(text)})); e.setAttribute('data-next-probe','1'); })()`);
  return click('[data-next-probe="1"]');
}
async function key(key, shift = false) { const codes = { Enter: ['Enter', 13, '\r'], ' ': ['Space', 32, ' '], Tab: ['Tab', 9, undefined], Escape: ['Escape', 27, undefined] }; const [code, n, text] = codes[key]; const p = { key, code, windowsVirtualKeyCode: n, nativeVirtualKeyCode: n, modifiers: shift ? 8 : 0, ...(text ? { text, unmodifiedText: text } : {}) }; await current.send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await current.send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); }
async function start() { await clickText('START'); await wait(`document.querySelector('.actionbar')`, 'game start'); }
async function nextVisitor() { await click('.actionbar .btn-approve'); await wait(`document.querySelector('.feedback')`, 'review feedback'); await clickText('NEXT'); await wait(`!document.querySelector('.feedback')`, 'next visitor'); }
async function scenario(name, fn) {
  const entry = { name, pass: false, screenshots: [] }; report.scenarios.push(entry);
  try { await fn(); entry.pass = true; console.log(`PASS ${name}`); }
  catch (e) { entry.error = String(e.stack || e); console.error(`FAIL ${name}: ${e.message}`); if (current) await shot(`${name}-failure`).catch(error => { entry.screenshotError = String(error); }); }
}
const records = n => Array.from({ length: n }, (_, i) => ({ visitorId: `v${String(i + 1).padStart(3, '0')}`, code: `V-${String(i + 1).padStart(3, '0')}`, move: 'APPROVE', correct: 'APPROVE', isCorrect: true, scoreDelta: 10, fundDelta: 20, inspected: false }));
const fixture = (index, extra = {}) => ({ index, score: index * 10, funds: 500, inspectedCount: 0, records: records(index), inspected: false, seenUpdates: [3, 6, 8].filter(n => n < index), phase: 'playing', pendingUpdate: null, lastRecord: null, ...extra });
async function modalFocus(selector, opener, { escape = true } = {}) {
  await wait(`document.querySelector(${JSON.stringify(selector)})`, 'modal visible');
  assert(await current.eval(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); return e.getAttribute('role')==='dialog' && e.getAttribute('aria-modal')==='true' && !!(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')); })()`), `${selector}: named modal semantics`);
  await wait(`document.querySelector(${JSON.stringify(selector)}).contains(document.activeElement)`, 'initial modal focus');
  await shot('modal-focused');
  // Focus ends explicitly, then exercise browser Tab at both boundaries.
  for (const backwards of [false, true]) {
    await current.eval(`(() => { const root=document.querySelector(${JSON.stringify(selector)}); const all=Array.from(root.querySelectorAll('button,[href],input,select,textarea,[tabindex]')).filter(e=>!e.disabled&&e.tabIndex>=0&&e.getClientRects().length); if(!all.length) throw Error('No modal focusables'); (${backwards} ? all[0] : all.at(-1)).focus(); })()`);
    await key('Tab', backwards);
    assert(await current.eval(`document.querySelector(${JSON.stringify(selector)}).contains(document.activeElement)`), `${selector}: ${backwards ? 'Shift+Tab' : 'Tab'} focus containment`);
  }
  if (escape) {
    await key('Escape'); await wait(`!document.querySelector(${JSON.stringify(selector)})`, 'Escape closes modal');
    assert(await current.eval(`document.activeElement===document.querySelector(${JSON.stringify(opener)})`), `${selector}: focus restored to opener`);
  }
}
try {
  if (typeof WebSocket === 'undefined') throw new Error('Node >=22 with built-in WebSocket required');
  await mkdir(out, { recursive: true });
  profile = await mkdtemp(path.join(tmpdir(), 'ai-please-next-chrome-'));
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve));
  endpoint = `http://127.0.0.1:${port}`;
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--no-proxy-server', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let spawnError, chromeLog = ''; chrome.on('error', e => { spawnError = e; }); chrome.stderr.on('data', data => { chromeLog = (chromeLog + data.toString()).slice(-4000); });
  let ready = false;
  for (let i = 0; i < 100; i++) { if (spawnError) throw spawnError; try { const r = await fetch(`${endpoint}/json/version`); if (r.ok) { report.browser = await r.json(); ready = true; break; } } catch {} await sleep(100); }
  if (!ready) throw new Error(`Chrome CDP unavailable: ${chromeLog}`);

  await scenario('broadcast-3-6-8-real-journey-refresh-ack', async () => {
    await page(); await start();
    for (let index = 0; index <= 8; index++) {
      if ([3, 6, 8].includes(index)) {
        await wait(`document.querySelector('.toast-wrap')`, `broadcast ${index}`); const original = await current.eval(`document.querySelector('.t-detail').innerText`); await shot(`broadcast-${index}-unacked`);
        assert(await current.eval(`Array.from(document.querySelectorAll('.actionbar button')).every(e=>e.disabled)`), `broadcast ${index}: actions locked until ACK`);
        await reloadResume();
        assert(await current.eval(`document.querySelector('.t-detail')?.innerText`) === original, `broadcast ${index}: unACKed survives refresh`, original);
        await clickText('ACKNOWLEDGE'); await wait(`!document.querySelector('.toast-wrap')`, 'ACK hides broadcast');
        await persisted(`s=>s?.seenUpdates?.includes(${index})`, `ACK ${index} persisted`); await shot(`broadcast-${index}-acked`);
        await reloadResume();
        assert(!await current.eval(`!!document.querySelector('.toast-wrap')`), `broadcast ${index}: ACK does not repeat after refresh`);
        const s = await runState(); assert(s.seenUpdates.filter(n => n === index).length === 1, `broadcast ${index}: ACK recorded once`, s.seenUpdates);
      }
      if (index < 8) await nextVisitor();
    }
  });
  await scenario('inspect-first-visitor-refresh-no-double-charge', async () => {
    await page(); await start(); await persisted('s=>s?.index===0', 'initial save'); const before = await runState();
    await click('.btn-inspect'); await persisted('s=>s?.inspected===true', 'INSPECT saved'); const paid = await runState();
    assert(paid.funds === before.funds - 25 && paid.inspectedCount === before.inspectedCount + 1, 'INSPECT charges exactly ¥25 once', { before, paid }); await shot('inspect-paid');
    await reloadResume();
    assert(await current.eval(`document.querySelector('.btn-inspect')?.disabled && !document.querySelector('.deep-panel')?.classList.contains('capped')`), 'INSPECT refreshed UI remains unsealed and disabled');
    // A disabled button must not charge via real keyboard activation either.
    await current.eval(`document.querySelector('.btn-inspect').focus()`); await key('Enter'); await sleep(150);
    const after = await runState(); assert(after.funds === paid.funds && after.inspectedCount === paid.inspectedCount && after.records.length === paid.records.length, 'INSPECT no repeat fee/count/review after reload', after); await shot('inspect-resumed');
  });
  for (const mode of ['STRICT', 'HUMAN']) await scenario(`last-visitor-refresh-ending-${mode}`, async () => {
    await page({ fixture: fixture(9) }); await clickText('RESUME'); await click('.actionbar .btn-approve'); await wait(`document.querySelector('.feedback')`, 'last visitor feedback');
    await persisted('s=>s?.records?.length===10', 'last review persisted'); const completed = await runState(); await shot('last-feedback');
    await reloadResume();
    // Both preserved feedback and direct verdict recovery are acceptable, but replaying V-010 is not.
    if (await current.eval(`!!document.querySelector('.feedback')`)) await clickText('PROCEED TO DEBRIEF');
    await wait(`document.querySelector('.mode-card.strict') && document.querySelector('.mode-card.human')`, 'ending choices restored'); await shot('ending-restored');
    await reloadResume(); await wait(`document.querySelector('.mode-card.strict')`, 'verdict survives another refresh');
    const restored = await runState(); assert(restored.records.length === 10 && restored.score === completed.score && restored.funds === completed.funds, 'last visitor not replayed or charged on recovery', { completed, restored });
    const modal = await current.eval(`document.querySelector('.mode-card').closest('[role="dialog"]')?.className || ''`);
    assert(Boolean(modal), 'ending choice has dialog semantics');
    if (modal) await modalFocus('[role="dialog"]', '', { escape: false });
    await click(`.mode-card.${mode === 'STRICT' ? 'strict' : 'human'}`); await wait(`!document.querySelector('.mode-card') && /${mode}/.test(document.querySelector('.shell').innerText)`, `ending ${mode} rendered`); await shot(`ending-${mode}`);
    assert(await current.eval(`localStorage.getItem(${JSON.stringify(RUN)})===null`), 'completed result clears resumable run');
  });
  for (const operation of ['getItem', 'setItem', 'removeItem']) await scenario(`storage-${operation}-failure-visible-no-white-screen`, async () => {
    await page({ storageFault: operation, ...(operation === 'removeItem' ? { fixture: fixture(10, { phase: 'verdict', records: records(10) }) } : {}) });
    if (operation === 'setItem') await start();
    if (operation === 'removeItem') { await clickText('RESUME'); await click('.mode-card.strict'); }
    await wait(`Array.from(document.querySelectorAll('[role="alert"],[role="status"],.storage-warning,.storage-notice')).some(e=>e.getClientRects().length && /存储|存档|保存|storage|进度/i.test(e.innerText))`, 'visible storage failure notice');
    assert(await current.eval(`document.querySelector('.shell').innerText.length>50 && document.querySelectorAll('button').length>0`), `${operation}: app remains usable, not blank`); await shot(`storage-${operation}-notice`);
    if (operation === 'getItem') { await start(); assert(await current.eval(`!!document.querySelector('.actionbar')`), 'read failure allows new shift'); }
    if (operation === 'setItem') { await click('.actionbar .btn-approve'); await wait(`document.querySelector('.feedback')`, 'write failure allows review'); }
  });
  await scenario('stamp-slots-enter-space-dialog-focus', async () => {
    await page({ fixture: fixture(1) }); await clickText('RESUME');
    // Accept either one named group button or separate named stamp buttons, never presentation-only divs.
    const slots = await current.eval(`(() => {const root=document.querySelector('.pp-slots'); if(!root)return []; const es=root.matches('button,[role="button"]')?[root]:Array.from(root.querySelectorAll('button,[role="button"]')); return es.map((e,i)=>{e.setAttribute('data-slot-probe',String(i));return {i,tag:e.tagName,role:e.getAttribute('role'),tabIndex:e.tabIndex,name:e.getAttribute('aria-label')||e.innerText};});})()`);
    assert(slots.length > 0 && slots.every(e => e.tabIndex >= 0 && e.name.trim()), 'stamp slots expose named keyboard button semantics', slots);
    for (const slot of slots) for (const activation of ['Enter', ' ']) {
      const opener = `[data-slot-probe="${slot.i}"]`; await current.eval(`document.querySelector(${JSON.stringify(opener)}).focus()`); await key(activation);
      await modalFocus('.pp-overlay [role="dialog"],.pp-overlay[role="dialog"]', opener);
      assert((await runState()).records.length === 1, 'opening stamp slot does not submit a review');
    }
    await click('.rule-toggle'); await modalFocus('.drawer', '.rule-toggle');
  });
  await scenario('feedback-modal-focus', async () => {
    await page(); await start(); await click('.actionbar .btn-approve');
    await wait(`document.querySelector('.feedback')`, 'feedback visible');
    assert(await current.eval(`!!document.querySelector('.feedback')?.closest('[role="dialog"]')`), 'feedback has dialog semantics');
    await modalFocus('[role="dialog"]', '', { escape: false });
  });
  await scenario('tutorial-modal-focus', async () => {
    await page(); await clickText('VIEW HOW TO PLAY'); await modalFocus('[role="dialog"]', '[data-next-probe="1"]');
  });
  assert(report.runtimeErrors.length === 0, 'no uncaught browser runtime exceptions', report.runtimeErrors);
  exit = report.scenarios.every(s => s.pass) && report.assertions.every(a => a.pass) ? 0 : 1;
} catch (error) {
  report.harnessError = String(error.stack || error); console.error(report.harnessError);
  exit = report.harnessError.includes('ASSERTION:') ? 1 : 2;
} finally {
  report.finishedAt = new Date().toISOString(); report.status = exit === 0 ? 'PASS' : exit === 1 ? 'FAIL' : 'HARNESS_ERROR'; report.exitCode = exit;
  for (const c of clients) c.close();
  if (chrome && chrome.exitCode === null) { chrome.kill('SIGTERM'); await Promise.race([new Promise(resolve => chrome.once('exit', resolve)), sleep(2000)]); if (chrome.exitCode === null) { chrome.kill('SIGKILL'); await new Promise(resolve => chrome.once('exit', resolve)); } }
  // Delete only the fresh, known temporary profile owned by this process.
  if (profile && path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('ai-please-next-chrome-')) await rm(profile, { recursive: true, force: true }).catch(e => { report.cleanupError = String(e); });
  await mkdir(out, { recursive: true }); await writeFile(path.join(out, 'test-results.json'), JSON.stringify(report, null, 2));
  console.log(`${report.status}: ${report.scenarios.filter(s => s.pass).length}/${report.scenarios.length} scenarios; evidence: ${out}`);
  process.exitCode = exit;
}
