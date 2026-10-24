# AI, PLEASE — AI SERVICE BORDER INSPECTOR

像素风手机竖屏审核游戏：你是 04 号窗口的边境审核员，逐一核对 AI 服务的入境申请，盖章放行或拒签。

- **3 天 30 位访客**：D01 首日 8 位 → D02 名单变更 10 位 → D03 特赦日 12 位，逐日解锁。
- **每局按种子重新洗牌**：14 个访客模板 + 6 张手工卡（特殊豁免 / 规则冲突），配额、字段、线索、姓名全由 `seed` 派生；同种子必得同一局。
- 7 条规则 / 数次名单与命令变更 / 双结局（STRICT MODE · HUMAN MODE）。
- 线上：**https://lusuallen.github.io/ai-please/**（GitHub Pages，push `main` 自动发布）
- 技术栈：TypeScript + Vite 5 + 纯 CSS（无后端、无 API、无登录，localStorage 存档）；源码写 React 18 API，**构建时把 `react` / `react-dom` 别名到 `preact/compat`**，框架体积从 ~45kB gzip 降到 ~11kB（见下）
- 玩法与逐条验收证据：见 [PROJECT_STATUS.md](PROJECT_STATUS.md)

## 本地开发

```bash
npm install
npm run dev            # http://127.0.0.1:5173/
npm run build          # 产物在 dist/（含 404.html 与 .nojekyll）
npm run preview        # http://127.0.0.1:4173/ai-please/ —— 只适合看样式
```

## 框架层减法（为什么源码写 React、产物是 Preact）

首屏 JS 一度顶到 69.88kB / 70kB 预算线，其中 ~45kB gzip 全在 React 运行时。源码继续用 React API（`useReducer` / `useSyncExternalStore` / `createRoot`），只把打包目标换成 `preact/compat`：

```ts
// vite.config.ts —— 想回退 React，删掉这段 resolve.alias 即可
const preactAlias = [
  { find: /^react$/, replacement: 'preact/compat' },
  { find: /^react-dom$/, replacement: 'preact/compat' },
  { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
  { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
  { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
];
```

等价性不是"应该没问题"，是量过的：**72 组生成快照哈希不变** `6ea6656d4ab9ad0e`、**50 单测全过**、**18 场景 / 325 断言全过**、**6 个关键界面与 React 产物逐像素一致（0 像素差异）**。`react` / `react-dom` 仍留在 `dependencies` 里只作类型来源，不参与打包。

## 门禁与验收

```bash
npm test               # 10 个套件：生成器 / 规则求值 / 存档 / 不变量 / 性能
npm run stress         # 10000 局全部过不变量校验（含 oracle 复算）
npm run verify:budget  # 首屏 JS ≤70kB、首屏 CSS ≤6.2kB、全部 JS ≤74kB、总产物 ≤260kB
npm run verify:local   # build + budget + test 一条龙
```

端到端验收**不要用 `vite preview`**（它会把 `/ai-please/assets/*.js` 回退成 index.html，得到假失败）。用 Pages 等价静态服务：

```bash
npm run build
npm run serve:dist          # http://127.0.0.1:4175/ai-please/
npm run verify:acceptance   # 18 场景 / 325 断言，证据写到 /tmp/ai-please-acceptance
```

调试某一局：`http://127.0.0.1:5173/?day=D03&seed=20261024`。URL 带种子时只在**没有可续玩进度**的情况下自动开局——刷新不会吞掉存档。

## 部署

推 `main` 即触发 `.github/workflows/deploy.yml`：`npm ci` → `npm test` → 构建 → `verify:budget` → 上传 Pages 产物 → 发布。
生产构建 base 为 `/ai-please/`，本地 dev 为 `/`（见 `vite.config.ts`）。

## 版本控制约定

本机 `/usr/local/bin/git` 架构不匹配（会报 `Bad CPU type in executable`），统一用 Xcode 自带的 git，并且不写入全局 config：

```bash
GIT=/Applications/Xcode.app/Contents/Developer/usr/bin/git
$GIT add -A
$GIT -c user.name="Allen Huang" -c user.email="allen.huang@ui.com" commit -m "..."
$GIT push origin main
```

`.mts` / `.ts` 脚本与测试都走 Node 的类型擦除，命令行需带 `--experimental-strip-types`（`npm test` / `npm run stress` 已内置）。
