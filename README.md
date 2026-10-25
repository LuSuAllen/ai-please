# AI, PLEASE — AI SERVICE BORDER INSPECTOR

像素风手机竖屏审核游戏：你是 04 号窗口的边境审核员，逐一核对 AI 服务的入境申请，盖章放行或拒签。

- **4 天 46 位访客**：D01 首日 8 位 → D02 名单变更 10 位 → D03 特赦日 12 位 → D04 十六条规则日 16 位，逐日解锁。D01–D03 是冻结的教学与进阶关（内容固定），D04 起由 `src/data/specs.ts` 的关卡配方生成。
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

等价性不是"应该没问题"，是量过的：**冻结区 D01–D03 的 72 组生成快照哈希不变** `6ea6656d4ab9ad0e`（新关单独汇总，不污染旧哈希）、**61 单测全过**、**20 场景 / 428 断言全过**、**6 个关键界面与 React 产物逐像素一致（0 像素差异）**。`react` / `react-dom` 仍留在 `dependencies` 里只作类型来源，不参与打包。

## 门禁与验收

合并前只需要一条命令，退出码 0 才允许进 `main`：

```bash
npm run verify:all     # build → 单测 61 → 预算 → 验收 20 场景/428 断言 → 双语探针
```

单项（排查用）：

```bash
npm test               # 13 个套件：生成器 / 规则求值 / 存档 / 不变量 / 性能 / 关卡配方 / 双语术语
npm run stress         # 10000 局全部过不变量校验（含 oracle 复算）
npm run verify:budget  # 首屏 JS ≤70kB、首屏 CSS ≤6.2kB、全部 JS ≤74kB、总产物 ≤260kB
npm run verify:local   # build + budget + test 一条龙（不含端到端）
```

端到端验收**不要用 `vite preview`**（它会把 `/ai-please/assets/*.js` 回退成 index.html，得到假失败）。用 Pages 等价静态服务：

```bash
npm run build
npm run serve:dist          # http://127.0.0.1:4175/ai-please/
npm run verify:acceptance   # 20 场景 / 428 断言，证据写到 /tmp/ai-please-acceptance
npm run verify:zh           # 双语注释探针：320/390 两档，中文副注折行=0、溢出=0、横向滚动=0
```

界面文案分三层，改之前先判断在哪一层：

| 层 | 例子 | 规则 |
| --- | --- | --- |
| 机器锚点 | `NEXT VISITOR` / `RESUME` / `START GAME` / `SCORING TABLE` | 英文必须是 DOM 可见 `innerText`，`verify-v3.mjs` 的 `clickText` / `includes` / 负断言都靠它；**不许** `display:none`、`sr-only` 或条件渲染 |
| 领域标签 | `ACCOUNT REGION · 账号`、`R01 OPEN ZONE · 开放区` | 英文主标 + 中文副注（`.bi-zh` 9px / `.bi-line` 双行），英文一个字母都不能少 |
| 操作与状态 | `判定正确`、`关闭`、`未解锁`、`未盖章`、`班次报告` | 中文为主（`.cn`，必须 `letter-spacing:0`），英文降为 7px 副标或直接省略 |

中文只允许放在视图层 `src/i18n/terms.ts`（数据层被快照哈希、I6 禁词、20KB 存档三道门禁锁着）。新增规则不配中文会被 `tests/i18n-terms.test.ts` 判红；新增英文锚点却删了中文，会被 `verify:acceptance` 的 `bilingual-controls-keep-both-layers` 场景判红。

调试某一局：`http://127.0.0.1:5173/?day=D03&seed=20261024`。URL 带种子时只在**没有可续玩进度**的情况下自动开局——刷新不会吞掉存档。

## 分支与部署

`main` 只接受 PR：开发在 `feat/*`（修复 `fix/*`，工程 `chore/*`），PR 上 CI 跑 `verify:all`，绿了再合并。
细则见 [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)；合并进 `main` 即触发 `.github/workflows/deploy.yml`：
`npm ci` → `npm test` → 构建 → `verify:budget` → 上传 Pages 产物 → 发布。
生产构建 base 为 `/ai-please/`，本地 dev 为 `/`（见 `vite.config.ts`）。

## 版本控制约定

分支流程见 [docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)（`feat/*` → PR → `verify:all` 绿 → 合并 `main` → 自动发布）。

本机 `/usr/local/bin/git` 架构不匹配（会报 `Bad CPU type in executable`），统一用 Xcode 自带的 git，并且不写入全局 git config。
`github.com:443` 不通，仓库已把 `origin` 指到 `git@github-ai-please:LuSuAllen/ai-please.git`（`~/.ssh/config` 里走 `ssh.github.com:443` + `~/.ssh/ai_please_deploy`），所以 `git fetch/push` 直接可用：

```bash
GIT=/Applications/Xcode.app/Contents/Developer/usr/bin/git
$GIT add -A
$GIT -c user.name="Allen Huang" -c user.email="allen.huang@ui.com" commit -m "..."
$GIT switch -c feat/<slug>          # 从最新 main 开分支，不直接提交 main
$GIT push -u origin feat/<slug>     # 走 PR 合并，细节见 docs/GIT_WORKFLOW.md
```

`.mts` / `.ts` 脚本与测试都走 Node 的类型擦除，命令行需带 `--experimental-strip-types`（`npm test` / `npm run stress` 已内置）。
