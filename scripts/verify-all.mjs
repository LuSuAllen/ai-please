#!/usr/bin/env node
/**
 * 合并门禁一条命令：本次改动能不能进 main，只看这个退出码。
 *
 * 顺序（快→慢，先便宜地失败）：
 *   1) tsc --noEmit + vite build + postbuild   （构建）
 *   2) 单测 61 条                              （数据层不变量）
 *   3) 预算门禁                                （首屏 JS/CSS、总产物）
 *   4) 起 dist 静态服务器 → 验收 20 场景 419 断言
 *   5) 双语探针（320/390，折行/溢出/遮挡）
 *
 * Usage: node scripts/verify-all.mjs [--skip-build] [--port 4175]
 * Exit 0 = 全绿；1 = 有门禁失败；2 = 编排自身出错。
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const argv = process.argv.slice(2);
const skipBuild = argv.includes('--skip-build');
const portArg = argv.indexOf('--port');
const PORT = portArg >= 0 ? Number(argv[portArg + 1]) : 4175;
const BASE = `http://127.0.0.1:${PORT}/ai-please/`;
const ROOT = path.resolve(import.meta.dirname, '..');

const run = (cmd, args) =>
  new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    let tail = '';
    const keep = (b) => {
      tail = (tail + b.toString()).slice(-4000);
    };
    child.stdout.on('data', keep);
    child.stderr.on('data', keep);
    child.on('close', (code) => resolve({ code: code ?? 1, tail }));
  });

const waitForPort = async (port, timeoutMs = 20000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await new Promise((resolve) => {
      const socket = net.connect({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
    });
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
};

const results = [];
const step = async (name, cmd, args) => {
  const started = Date.now();
  process.stdout.write(`\n▶ ${name}\n`);
  const { code, tail } = await run(cmd, args);
  const ms = Date.now() - started;
  results.push({ name, code, ms });
  if (code !== 0) {
    process.stdout.write(tail.trimEnd() + '\n');
    process.stdout.write(`✗ ${name} 失败（${(ms / 1000).toFixed(1)}s）\n`);
  } else {
    process.stdout.write(`✓ ${name}（${(ms / 1000).toFixed(1)}s）\n`);
  }
  return code;
};

const failed = async () => {
  console.log('\n=== 门禁未通过 ===');
  for (const r of results) console.log(`${r.code === 0 ? '✓' : '✗'} ${r.name}  ${(r.ms / 1000).toFixed(1)}s`);
  process.exit(1);
};

if (!skipBuild) {
  if ((await step('build（tsc + vite + postbuild）', 'npm', ['run', 'build'])) !== 0) await failed();
}
if ((await step('unit（node --test）', 'npm', ['test'])) !== 0) await failed();
if ((await step('budget（首屏 JS/CSS、总产物）', 'npm', ['run', 'verify:budget'])) !== 0) await failed();

// 验收 / 探针都要一个把 /ai-please/ 映射到 dist 的静态服务器
const server = spawn('node', ['scripts/serve-dist.mjs', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
const stopServer = () => {
  if (!server.killed) server.kill('SIGTERM');
};
process.on('exit', stopServer);
process.on('SIGINT', () => {
  stopServer();
  process.exit(2);
});

if (!(await waitForPort(PORT))) {
  console.error(`✗ 静态服务器未在 ${PORT} 起来（serve-dist 启动失败）`);
  process.exit(2);
}

try {
  if ((await step('acceptance（20 场景 / 419 断言）', 'node', ['--experimental-strip-types', 'scripts/verify-v3.mjs', '--url', BASE, '--out', '/tmp/ai-please-acceptance'])) !== 0) {
    await failed();
  }
  if ((await step('zh probe（320/390 双语排版）', 'node', ['--experimental-strip-types', 'scripts/probe-zh.mjs', '--url', BASE, '--out', '/tmp/ai-please-zh-probe'])) !== 0) {
    await failed();
  }
} finally {
  stopServer();
}

console.log('\n=== 门禁全绿，可以合并 ===');
for (const r of results) console.log(`✓ ${r.name}  ${(r.ms / 1000).toFixed(1)}s`);
