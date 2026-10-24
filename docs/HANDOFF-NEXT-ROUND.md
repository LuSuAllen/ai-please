# 交接提示词 · AI, PLEASE 第九轮（阶段 5 展示优化 + 机制扩展）

> 用途：把本文件**整份**交给接手 agent 作为任务提示词。第一部分可直接复制粘贴；第二至第七部分是它必须遵守的规格与门禁。
> 生成时间：2026-10-24 · 依据 HEAD `414d69f`（main 与 origin/main 同步、工作树干净）· 由 CTO 与 Git 工作流工程师两份规格合成。

---

## 第一部分 · 可复制提示词（直接粘给接手 agent）

```text
你是 AI, PLEASE 项目的接手工程师。工作目录 /Users/lusuallen/Downloads/ai-please，
线上 https://lusuallen.github.io/ai-please/ （GitHub Pages，push main 即自动发版）。
技术栈：React 18 API + TypeScript + Vite 5 + 纯 CSS + localStorage，构建期用 preact/compat 别名换取体积。

先读这四份，再动手（不要跳过）：
  README.md
  PROJECT_STATUS.md（第 13.7、14 章）
  docs/HANDOFF-NEXT-ROUND.md（本文件，是你的完整规格）
  src/game/validate.ts + src/data/levels.ts（理解不变量 I1–I14 与三天蓝图）

任务：推进「阶段 5 · 现场展示优化」的 P0 七项（见规格 §4.1），P1 尽量做；机制扩展按 B→A 顺序在
P0 全绿后开工，C 单独立项。全程不改判定与生成逻辑，快照哈希必须恒为 6ea6656d4ab9ad0e。

硬约束（违反即返工）：
- git 只能用 /Applications/Xcode.app/Contents/Developer/usr/bin/git（/usr/local/bin/git 架构错）
- 提交身份用 -c user.name="Allen Huang" -c user.email="allen.huang@ui.com" 传入，不改全局 config
- main 无 upstream，push 必须写 git push origin main
- 不许改 verify-v3.mjs 断言、check-budget.mjs 阈值、游戏业务代码来「让门禁变绿」
- 验收服务只用 node scripts/serve-dist.mjs 4175，禁用 vite preview（会假失败）
- 每个提交前单独跑 build + budget + npm test；线上验收通过后才写文档章节与证据图

交付物：代码 + 测试 + PROJECT_STATUS 新开 "## 15. 第九轮" + 线上验收证据图（docs/shots/24- 起）
+ 一次线上 verify-v3 全绿记录。完成后按规格 §7 的 DOD 自查，逐条给证据。
```

---

## 第二部分 · 项目事实基线（写死，别猜）

| 事实 | 值 |
| --- | --- |
| 仓库 / 线上 | `LuSuAllen/ai-please` · https://lusuallen.github.io/ai-please/ （项目页，base `/ai-please/`） |
| HEAD | `414d69f`；`main` 与 `origin/main` 差 0/0；`main` **无 upstream** |
| 技术栈 | React 18 API 源码 + 构建期 `preact/compat` 别名、TS 5.6、Vite 5.4、纯 CSS、localStorage v3 |
| 关卡 | D01 8 位 / D02 10 位 / D03 12 位；规则数 **6 / 6 / 7**（实测） |
| 门禁命令 | `npm run build`、`npm run verify:budget`、`npm test`（47 断言）、`node --experimental-strip-types scripts/snapshot-runs.mts`、`npm run serve:dist` + `scripts/verify-v3.mjs`、`npm run stress` |
| 等价性快照 | `combined = 6ea6656d4ab9ad0e`（72 组：3 天 × 24 seed） |
| 本地 Node | v24.17.0；CI 为 Node 22（本地绿 ≠ CI 绿） |
| CI（deploy.yml） | 仅 `push main` / `workflow_dispatch` → `npm ci` → `npm test` → `build` → `verify:budget` → deploy。**不跑快照、不跑 e2e（无 Chrome）** |

### 实测预算（CTO 本轮复核，可复现）

| 指标 | 实测 | 门禁 | 余量 |
| --- | --- | --- | --- |
| 首屏 JS gzip | 31,873 B | 70,000 B | **38,127 B（已用 45.53%）** |
| 全部 JS gzip | 34,756 B | 74,000 B | 39,244 B |
| CSS gzip | 5,342 B | **无门禁（盲区）** | — |
| 总产物 raw | 118,105 B | 260,000 B | 141,895 B |
| 生成 p95 | D01 0.225 / D02 0.267 / D03 0.296 ms | 硬上限 16 ms | 斜率 ≈ +0.021 ms/访客 |
| 存档体积 | 780 B/访客；D03 最坏 13,515 B | 20 KB | 16 位 ≈ 12.6 KB（63%） |

> 口径纠正：此前口头说的「45.5% 余量」实为**已用 45.53%**，可用余量是 38,127 B。

### 边际体积（esbuild bundle+minify+gzip9 实测，用于扩展决策）

手工卡 **154 B/张** · 模板 **84 B/个** · 一天 blueprint **125 B** · 单条规则判定 **45 B**。

---

## 第三部分 · 硬约束（红线）

1. **判定层冻结**：不改 `src/game/rules-eval.ts`、`engine.ts`、`zones.ts`、`rng.ts`、`validate.ts`。
2. **生成层冻结**（阶段 5 全程）：不改 `src/game/generator.ts`、`src/data/{templates,cards,levels,balance,rules,regions}.ts`。
3. **快照不变**：`combined` 必须恒为 `6ea6656d4ab9ad0e`。变了 = 玩法变了，必须显式声明并按新基线重签。
4. **不碰门禁口径**：`verify-v3.mjs` 断言、`check-budget.mjs` 阈值、`snapshot-runs.mts` 覆盖范围不得为「变绿」而修改。唯一允许的阈值新增是 CSS 预算（S5-A5，需同步 README 与 PROJECT_STATUS）。
5. **存档不变**：localStorage 键名与 `v3` 版本号不动；纯增字段不升版本。
6. **不使用 `vite preview` 验收**（`/ai-please/assets/*.js` 会回退成 index.html → 假失败）。
7. **不改** `vite.config.ts` 的 `base`、preact 别名、`dist/` 提交状态。

---

## 第四部分 · 任务清单

### 4.1 P0（本轮必做，7 项）

| ID | 事项 | 位置 | 做法 | 验收判据 |
| --- | --- | --- | --- | --- |
| S5-H1 | 首屏「七条规则」与实际规则数矛盾（**信息错误**） | `src/screens/HomeScreen.tsx:38` | 文案改为 `{visitorCount} 位访客，{ruleCount} 条规则`，`ruleCount = rulesForEvents(getBlueprint(day).events).length` | D01 显示 6、D03 显示 7；不出现「七条规则」 |
| S5-H2 | 三个 CTA 无主次 | `HomeScreen.tsx:60+`、`global.css:935` | 开始游戏 → `btn-approve`（主）；RESUME → `btn`；VIEW HOW TO PLAY → `btn-ghost` + `min-height:40px`。**保留英文小字文本**（`START GAME`/`RESUME`/`VIEW HOW TO PLAY` 是 `clickText()` 锚点） | DOM class 依次正确；`verify:acceptance` 10/10 不退化 |
| S5-P1 | 进度条对辅助技术不可见 | `src/components/StatusBar.tsx:50` | `.stat-progress` 加 `role="progressbar"` + `aria-valuemin/max/now/valuetext`；`.pip-track` 保留 `aria-hidden` | 开局 `aria-valuenow=0`，判完一位 `=1`，`aria-valuemax===total` |
| S5-P2 | 每位访客强制 900 ms 死等 | `src/screens/GameScreen.tsx:60-69` | `prefers-reduced-motion: reduce` → 0 ms；默认 → 340 ms（`stamp-in` 320 ms 的稳妥值）；`STAMP_MS` 降级为兜底上限 | reduced-motion 点击→`.feedback` 可见 ≤150 ms；默认 ≤600 ms；`records.length` 恰好 +1 |
| S5-R1 | 结算页死渲染 `display:none` 姓名 | `src/screens/ResultScreen.tsx:111` | 删除该节点（不参与布局又进 innerText） | 无 `[style*="display: none"]`；`.result` innerText 不含访客姓名 |
| S5-A1 | 禁止缩放（WCAG 1.4.4） | `src/index.html:5-8` | 去掉 `maximum-scale=1.0, user-scalable=no`；`body`/`.btn` 加 `touch-action:manipulation` | viewport 不含 `user-scalable=no`；2× 页面缩放后无横向溢出 |
| S5-A5 | CSS 完全不在预算门禁里 | `scripts/check-budget.mjs` | 新增 `INITIAL_CSS_GZIP_BUDGET=6200`，把 `dist/index.html` 引用的 CSS 纳入统计并打印 `[首屏CSS]` 行，超限 exit 1 | 打印四行预算；临时 +1 kB CSS 时 exit 1（用 /tmp 副本验证） |

P0 全绿后再统一跑：`build + budget + test` → 快照哈希 → `serve:dist` + `verify:acceptance`。

### 4.2 P1（本轮尽量做，10 项）

| ID | 事项 | 位置 | 验收判据 |
| --- | --- | --- | --- |
| S5-H3 | day chip 内联样式 + 锁定态无说明 | `HomeScreen.tsx:12-13` | 所有 `.day-pick button` 无 `style` 属性；锁定 chip `aria-label` 含「未解锁」 |
| S5-H4 | 320×568 首屏顶部被裁 | `global.css:872` | `.home-kicker` 的 `getBoundingClientRect().top >= 0` |
| S5-P3 | 信号等级只靠颜色 | `GameScreen.tsx` 信号面板、`global.css:441` | 每个 `.signal` 文本含 `ALERT/WARN/INFO`；面板 tag 含 `FLAG` |
| S5-P5 | 计分表每位重复 | `FeedbackOverlay.tsx:60` | 第 1、2 位含 `SCORING TABLE`，第 3 位起不含 |
| S5-P6 | YOU:/REQUIRED: 9px 最暗灰 | `global.css:810` | `fontSize==='11px'` 且 `color==='rgb(134, 152, 179)'` |
| S5-P7 | ACKNOWLEDGE 触摸目标偏小 | `global.css:1094` | `.toast .t-action` 高度 ≥40px |
| S5-P8 | 320px 下 tier 标签被 `display:none` | `global.css:1236-1238` | `.pp-tier` 可见且 `getClientRects().length>0` |
| S5-R2 | 结算错行不可辨 | `ResultScreen.tsx`、`global.css:1041` | `.log-row.bad` 存在、`borderLeftWidth==='3px'`、对比度仍 ≥4.5:1 |
| S5-R3 | MISJUDGED 塞两个数 | `ResultScreen.tsx` `.result-grid` | 出现「误放行」「误拒绝」各一次 |
| S5-A2 | 判定结果无 live 播报 | `GameScreen.tsx` | 存在 `[aria-live=polite].sr-only`，文本随判定变化；`dialogs-focus-trapped` 不退化 |
| S5-A3 | 动效预算无门禁 | 新增 `tests/display-budget.test.ts` | 动画白名单（fade-in 120 / slide-up 160 / slide-down 180 / stamp-in 320·380 / pip-pulse 1.1s / blink 1.2s / btn 60）；`infinite` ≤2；非白名单时长 ≤400 ms |
| S5-A4 | 设计 token 收敛 6/4/5/2 | `global.css` 全量 | 字号 12→6、字距 12→4、间距 16→5、box-shadow 12→2；五视口截图 + `overflowX===0`。**风险最高，单独 PR、放最后** |

### 4.3 P2（可延后）

`S5-H5` BEST SCORE 与 day chip 去重 · `S5-P9` `memo()` 化（不设硬性能门禁，否则必 flaky）· `S5-R5` 结算页展示 `SHIFT SEED`（+ 可复制 `?day=&seed=`）· `S5-P4` DEEP FILE 开档后加标准 TZ/LANG 对照（**会降低 A-TZ/A-LANG 难度，需签字**）。

### 4.4 新增 e2e 场景（照抄实现）

1. `home-copy-matches-rule-count`：D01 `/6 条规则/`；meta 预置 `unlockedDay:'D03'` 后 `/7 条规则/`；均不含「七条规则」。
2. `progressbar-exposes-position`：`aria-valuemin="0"`、`aria-valuemax===total`、`aria-valuenow` 0→1、`aria-valuetext` 含「共 {total} 位」。
3. `stamp-wait-bounded`：`Emulation.setEmulatedMedia({features:[{name:'prefers-reduced-motion',value:'reduce'}]})` 后 ≤150 ms；默认 ≤600 ms；两种模式 `records.length` 均恰好 +1。
4. `scoring-table-first-two-only`。
5. `touch-target-min-40`：`.toast .t-action`、`.actionbar .btn`、`.day-pick button`、`.pp-open`、`.pp-portrait`、`.pp-slots`。
6. `zoom-enabled`：viewport 无 `user-scalable=no`；`setPageScaleFactor(2)` 后无横向溢出。
7. `display-change-no-answer-leak`：**每轮展示改动后必跑**——判定前 `body.innerText` 不含 `explanation`、任何 `hiddenClues`、`VERDICT ACCEPTED/REJECTED`。

> 断言口径：允许新增，**不得减少**。报告需同时给「旧 10 场景 · 241 断言」与「新增场景/断言数」，两者都绿。

---

## 第五部分 · 机制扩展（P0 全绿后按序开工）

> 关键前提：`snapshot-runs` 只跑 D01–D03 的 72 组。**碰到三天蓝图/卡槽/权重，哈希就变**——那就不是扩展，是改生成结果。

| 候选 | 内容 | 体积 | p95 | 快照 | 新增不变量 | 风险 | 顺序 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **B 天数扩展 D04（16 位）** | quota 六项和=16（例 N4 D3 A5 I2 S1 C1）；事件 `R06@3`、`amnesty@5 len3`、`zoneChange@7`、`R07@9`、`zoneChange@12`；S 池 `{4:S-AMNESTY, 8:S-MAINT-UND}`、C 池 `{9:C-AMNESTY-BLOCKED, 13:C-EXEMPT-EXPIRED}` | **+125 B** | ≈0.38 ms | **不变** | I15 | 低 | **第 1 个** |
| **A 手工卡扩容 6→9** | 只加在 D04 的卡槽（加进 D01–D03 会改哈希） | +462 B | ≈0 | 仅新天为 0 | I16 | 中 | 第 2 个 |
| C 规则组合变体（R08 / `ruleRevoke`） | 新增事件类型 + 广播 + 抽屉 + oracle 分支 | +0.4–0.8 kB | +0.01–0.02 ms | 不变（但动判定） | I17 | **高** | 第 3 个，独立一轮 |

### 需新增的不变量（只加测试与文档，不改运行时逻辑）

- **I15**：任一 blueprint 的 `quota` 六项之和 === `visitorCount`（现在只靠生成失败兜底）。
- **I16**：`CARDS` 每个 id 至少出现在某个 blueprint 的 `cardSlots.candidates`，且被选中的卡确实落在声明 index。
- **I17**：`run.events` 的 `kind` 必须在白名单内，且 `updates` 与事件一一对应（`validateSaved` 目前只校验 `Array.isArray(events)`，脏档可静默通过）。

### B 的必须新增测试

1. `tests/invariants.test.ts` 加 I15；
2. distribution/invariants 遍历 `DAY_IDS` 自动含 D04（断言全模板可达）；
3. `tests/storage.test.ts` 加 `unlockedDay:'D04'` + `bestByDay.D04`；
4. e2e 新场景 `day3-completion-unlocks-day4`（通关 D03 → 解锁 D04 → 刷新续档）；
5. `npm run stress` 10000 局零失败，`perDay.p95 ≤ 2 ms`；
6. **回归点**：D00 旧档恢复时 `HomeScreen` 的 `unlockedIdx = DAY_IDS.indexOf('D00') === -1` 分支不得崩。

### 双编号对照（改之前先对表，别按文档编号改代码）

代码 `src/game/validate.ts` 与文档 `docs/design/levels-random-cto.md` 的 I1–I14 **不是一套编号**。已知缺口：文档 I4（tier 与 findings 结构）在代码中**未单列**（只有各卡 `check()`）、I11（难度抖动）**未实现**、I6 的卡槽命中**未校验**、I12 仅靠 e2e 场景兜。动手前逐条对表。

---

## 第六部分 · Git 工作流（交接版）

### 6.1 环境与事实

```bash
GIT=/Applications/Xcode.app/Contents/Developer/usr/bin/git   # /usr/local/bin/git 架构错，禁用
ID=(-c user.name="Allen Huang" -c user.email="allen.huang@ui.com")   # 绝不写全局 config
```

- `deploy.yml` 只监听 `push main` + `workflow_dispatch` → **推 `work/` 分支拿不到任何 CI 信号**。
- CI 只跑 `test → build → budget`，不跑快照与 e2e → **本地门禁是承重的，不是可选项**。
- 并发 `group: pages` + `cancel-in-progress: true` → 后推的提交自动取消在跑的部署。

### 6.2 分支策略：main 直推为默认，`work/` 为风险闸

不引入常规 PR（PR 买不到 CI 信号，除非另加 `on: pull_request` 的 ci.yml——独立决策）。
满足任一条件才开 `work/` 短命分支：触碰 `src/game/**`/`src/data/**`/存档 · 改构建配置或依赖 · 预期提交数 ≥3 · 需试错 >1 次。

```bash
$GIT fetch origin
$GIT switch -c work/round9-<topic> origin/main
# 多次提交，每次本地过门禁 1–4
$GIT switch main && $GIT merge --ff-only work/round9-<topic>
$GIT push origin main
$GIT branch -d work/round9-<topic>
```

合并前自审（留输出）：`log --oneline origin/main..HEAD`、`diff --stat origin/main...HEAD`、`diff origin/main...HEAD -- src/game src/data`。

回滚三层：未 push → `reset --soft HEAD~1`；已 push → `revert --no-edit <sha> && push origin main`（首选，历史可审计）；仅当 `rev-list --left-right --count` 证明无人推进，才允许 `push --force-with-lease=main:<sha>`。

### 6.3 提交粒度

按类型拆：代码（一个可回滚行为单元=一个提交）· 测试（断言新行为随代码同提交；补存量覆盖独立 `test:`）· 门禁脚本（独立 `chore(scripts):`）· 依赖（独立 `chore:`）· 文档章节（独立 `docs:`，在实现提交之后）· **证据图（必须独立，且只能在线上验收之后——push 前线上截图不存在）**。

禁止混提：性能改造 vs 死代码清理；换引擎 vs 顺带 bug 修复（唯一例外：不修就红）；文案 vs 验收锚点。

提交信息模板（沿用本项目风格）：

```text
<type>: <一句话结论，优先给数字/方向>（<机制或证据锚点>）

<为什么改 / 根因，2–4 行；有取舍必须写>

证据:
- 快照 72 组 combined=6ea6656d4ab9ad0e（未变 / 新值）
- 单测 47/47
- 预算 首屏 31.92kB/70kB；全部 JS 34.74kB/74kB；总 118.10kB/260kB
- e2e 10/10 场景 241 断言，runtimeErrors=0
- 线上 index-*.js 命中；线上 10/10·241

Refs: PROJECT_STATUS §15.x
```

`type` 白名单：`feat`/`fix`/`perf`/`refactor`/`test`/`docs`/`chore`。带数字的改动必须同时写基线与新值。

### 6.4 门禁顺序（不可调换）

`build → budget → test → 快照 → serve-dist+verify-v3 → push → 轮询线上哈希 → 线上 verify-v3`

| # | 步骤 | 通过判据 | 失败处理 |
| --- | --- | --- | --- |
| 0 | 预检 | `git status --short` 空；`main...origin/main` = `0 0` | 脏文件先定归属 |
| 1 | `npm run build` | exit 0；`dist/.nojekyll`、`dist/404.html` 存在 | tsc 报错修类型，不改 tsconfig |
| 2 | `npm run verify:budget` | `✔ 预算门禁通过` | **不许改预算常量**，先减法；超限需用户签字 |
| 3 | `npm test` | 47/47 pass | 红就定位判定层；flaky 连跑 3 次 |
| 4 | 快照 | `combined=6ea6656d4ab9ad0e` | 变了先判「有意/手滑」 |
| 5 | `serve:dist` + `verify:acceptance` | `10/10 · 241 · runtimeErrors=0` | exit 1 = 真 bug；exit 2 = 探针自身错（端口/Chrome 路径），不当作产品 bug |
| 6 | commit + push | `git push origin main` 成功 | 超时重试 ≤3 次，间隔 10–20s |
| 7 | 轮询线上产物 | 线上 `assets/index-*.js` 与本地同名且 200 | 8×10s 未命中查 Actions，**不要盲重推** |
| 8 | 线上 verify-v3 | `10/10 · 241 · runtimeErrors=0` | 本地绿线上红 → 先查 base 路径与资源 404 |

> CI 顺序 `test→build→budget`（先便宜后贵）与本地 `build→budget→test`（预算须量「将要发布的产物」）不同，两者都对。

### 6.5 入库 / 禁止入库

**入库**：`docs/shots/`（两位序号连续，当前最大 `23-` → 从 `24-` 起；命名 `<序号>-<local|live>-<轮次>-<页面/断言>-<视口>.png`；线上图必须带 `live-`）、`PROJECT_STATUS.md`、`docs/design/**`、`scripts/*` + `package.json` scripts（同一提交）、`.github/workflows/deploy.yml`。

**禁止**：`dist/`、`node_modules/`、`*.log`、`.DS_Store`、`/tmp` 临时证据原件、Chrome profile/CDP 临时目录、任何 `.map`、一次性排查脚本。

**PROJECT_STATUS 编号规则**：一轮 = 一个顶层 `## N.`，标题 `## N. 第X轮：<主题>（YYYY-MM-DD）`；子节 `### N.M` 递增不复用；每轮固定含「改了什么 / 线上验收（真实地址）/ 签字状态」三节，必须写提交哈希 + 轮询命中次数 + 线上断言数。
**已知偏差，本轮修正**：`### 14.9`/`### 14.10` 实为第八轮却挂在 `## 14` 之下 → 第九轮**新开 `## 15.`**；`§11.1` 发布链路表缺 `npm test` 与 `verify:budget`（工作流实际已含）→ 一并修正。

### 6.6 常见事故

| 症状 | 判断 | 处理 |
| --- | --- | --- |
| `push` 超时 / `Failed to connect` | 网络问题（历史 `2899418` 首次超时、重试即成功） | 原命令重试 ≤3 次；再不行 `git ls-remote origin main` 分辨连通性 |
| push 成功但线上仍旧 | Pages 传播 30–70s 属正常 | 轮询产物哈希 → 查 Actions run |
| 线上 HTML 换了但 js 哈希不变 | 改动被摇掉（树摇生效）或本轮只是 `docs:` | 比全量文件名 + 三个预算数字；别为「让哈希变」加代码 |
| 已推提交要撤 | — | `revert --no-edit <sha> && push origin main` |
| `verify-v3` exit 2 | 探针自身错 | `lsof -ti:4175 \| xargs kill`；显式 `--chrome`；URL 必须 http(s) |
| 深链接刷新 404 | 正常行为 | `404.html` 回落，内容与 index 一致 |

---

## 第七部分 · 完成判定（DOD）与待签字

### 7.1 DOD（逐条给证据，不许口头）

1. `npx tsc --noEmit` 0 error；`npm test` 47 + 新增全绿。
2. `npm run verify:budget` 打印四行（首屏 JS / 首屏 CSS / 全部 JS / 总产物）且通过。
3. 快照 `combined` 仍为 `6ea6656d4ab9ad0e`（或已显式重签并说明原因）。
4. 本地 `verify:acceptance` 10/10 · 241 + 新增场景全绿，`runtimeErrors=0`。
5. 线上 `verify-v3` 全绿 + 线上产物哈希命中记录。
6. 320×568 与 390×844 下 `document.documentElement.scrollWidth <= innerWidth`（展示类改动必给截图）。
7. `PROJECT_STATUS.md` 新开 `## 15.` 并含三节 + 提交哈希；§11.1 链路表已修正。
8. 证据图 `docs/shots/24-` 起连续编号并入库。
9. 若动机制扩展：`npm run stress` 10000 局零失败、`perDay.p95 ≤ 2 ms`。

### 7.2 仍需用户签字（不做，等回复）

| 项 | 内容 | 默认 |
| --- | --- | --- |
| ★3 | 两条线索直接写结论（V-007/V-010） | 不做 |
| ★5 | 资金只增不减 → 改 `inspectQuota(total)` 或删第二货币 | 不做 |
| S5-R4 | AUDIT LOG 与 FINAL VERDICT 的先后（现状：FINAL VERDICT 在前） | 保持现状 |
| S5-P4 | DEEP FILE 开档后加标准 TZ/LANG 对照（降低 A-TZ/A-LANG 难度） | 不做 |
| 机制扩展 | B/A/C 取舍与是否重签快照基线 | 先 B，仅新天加卡 |

---

## 附 · 本轮已知事故（如实披露）

CTO 在只读普查阶段执行 `ls … && tee package.json` 时误将 `package.json` 截断为 0 字节，已用 `git show HEAD:package.json` 字节级还原（1,057 B），`git status --porcelain` 为空、工作树干净。规格产出全程只读，探针与证据放在 `/tmp/ai-please-spec/`，未修改仓库任何文件。接手 agent 开工前请自行复核一次 `git status` 与 `wc -c package.json`。
