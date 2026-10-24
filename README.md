# AI, PLEASE — AI SERVICE BORDER INSPECTOR

像素风手机竖屏审核游戏：你是 04 号窗口的边境审核员，逐一核对 AI 服务的入境申请，盖章放行或拒签。
10 位访客 / 7 条规则 / 3 次规则变更 / 2 个特殊事件 / 双结局（STRICT MODE · HUMAN MODE）。

- 线上：**https://lusuallen.github.io/ai-please/**（GitHub Pages，push `main` 自动发布）
- 技术栈：React 18 + TypeScript + Vite 5 + 纯 CSS（无后端、无 API、无登录，localStorage 存档）
- 玩法与验收记录：见 [PROJECT_STATUS.md](PROJECT_STATUS.md)

## 本地开发

```bash
npm install
npm run dev       # http://127.0.0.1:5173/
npm run build     # 产物在 dist/，含 404.html 与 .nojekyll
npm run preview   # http://127.0.0.1:4173/ai-please/
```

## 部署

推 `main` 即触发 `.github/workflows/deploy.yml`：构建 → 上传 Pages 产物 → 发布。
生产构建 base 为 `/ai-please/`，本地 dev 为 `/`（见 `vite.config.ts`）。
