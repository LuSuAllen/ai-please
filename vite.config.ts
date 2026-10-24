import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 项目页部署在 https://<user>.github.io/ai-please/，生产构建必须带仓库前缀；
// 本地 dev 仍走根路径，避免每次改探针脚本。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/ai-please/' : '/',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { sourcemap: false },
}));
