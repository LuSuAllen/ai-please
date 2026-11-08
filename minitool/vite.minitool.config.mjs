// 小红书小工具离线包构建配置（与 GitHub Pages 构建隔离，产物在 dist-minitool/）。
// 目标：单入口 classic script（非 module）、相对路径、ES2017/Chrome 61、CSS 汇总为一个文件。
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const preactAlias = [
  { find: /^react$/, replacement: 'preact/compat' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
];

export default defineConfig({
  base: './',
  define: {
    // 诊断包专用：MINITOOL_RANK_DEBUG=1 构建时才会把排行榜自证面板打进产物
    __RANK_DEBUG__: JSON.stringify(process.env.MINITOOL_RANK_DEBUG === '1'),
  },
  plugins: [react()],
  resolve: { alias: preactAlias },
  build: {
    outDir: 'dist-minitool',
    emptyOutDir: true,
    target: ['es2017', 'chrome61'],
    sourcemap: false,
    cssCodeSplit: false,
    modulePreload: false,
    assetsInlineLimit: 0,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
