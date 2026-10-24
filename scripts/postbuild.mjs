// GitHub Pages 需要两件东西，Vite 不会帮你做：
// 1) 404.html —— 站点没有服务端路由，深链接刷新必须回落到同一个 SPA；
// 2) .nojekyll —— 否则 Jekyll 会吞掉 _ 开头的资源目录。
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
if (!existsSync(join(dist, 'index.html'))) {
  console.error('[postbuild] dist/index.html 不存在，构建没跑完？');
  process.exit(1);
}
copyFileSync(join(dist, 'index.html'), join(dist, '404.html'));
writeFileSync(join(dist, '.nojekyll'), '');
console.log('[postbuild] dist/404.html + dist/.nojekyll 就位');
