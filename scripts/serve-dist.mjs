/**
 * 本地 Pages 等价服务器：把 /ai-please/ 映射到 dist 目录，资源命中真实文件。
 * 存在的意义：`vite preview` 会把 /ai-please/assets/*.js 回退成 index.html，
 * 拿来验生产构建会得到假失败（见 PROJECT_STATUS §12.3 坑 1）。
 * 用法：node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..', 'dist');
const PORT = Number(process.argv[2] ?? 4175);
const BASE = '/ai-please/';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { location: BASE });
    res.end();
    return;
  }
  const rel = normalize(decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html').replace(/^(\.\.(\/|$))+/, '');
  let file = join(ROOT, rel);
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(ROOT, 'index.html'); // SPA 回退，与 Pages 的 404.html 行为一致
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`read failed: ${String(error)}`);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}${BASE}`);
});
