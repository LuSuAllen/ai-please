import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 项目页部署在 https://<user>.github.io/ai-please/，生产构建必须带仓库前缀；
// 本地 dev 仍走根路径，避免每次改探针脚本。
//
// 框架层减法：源码仍写 react 的 API（useState/useReducer/createRoot…），
// 构建时把 react / react-dom 全部指向 preact/compat，产物里的框架从 ~45kB gzip 降到 ~11kB。
// 行为等价性由「72 组生成快照 + 10 场景端到端 + 像素截图」共同验证。
const preactAlias = [
  { find: /^react$/, replacement: 'preact/compat' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
];

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ai-please/' : '/',
  plugins: [react()],
  resolve: { alias: preactAlias },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { sourcemap: false, reportCompressedSize: true },
}));
