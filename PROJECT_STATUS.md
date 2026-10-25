# PROJECT STATUS — AI, PLEASE / AI SERVICE BORDER INSPECTOR

> 本文件是唯一事实来源。凡是没在这里贴出验证证据的东西，一律视为"未测试"。
> 最后更新：2026-10-24（第六轮：多关卡 + 种子随机化，30 位访客 / 3 天 / 20 个模板与卡池；本地 10 场景 241 断言 + 47 单测全过）

---

## 1. 当前阶段

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 阶段 0 | 环境检查 | ✅ 完成 |
| 阶段 1 | 可玩骨架（10 访客 / 规则 / 评分 / 结算 / 存档） | ✅ 完成，已实机验证 |
| 阶段 2 | 手机 UI 与像素风 | 🟡 已完成内部四专家评审 + 7 项 P0 修复；护照 GUI 已落地（§10），待用户确认剩余项 |
| 阶段 2.5 | 护照 GUI（查看 → 放大 → 盖章/拒签） | ✅ 完成，43 项断言全过 |
| 阶段 3 | 规则与评分 | ✅ 已落地并验证 |
| 阶段 4 | 特殊事件与剧情 | ✅ 已落地并验证 |
| 阶段 2.8 | 稳定性与无障碍（存档恢复公平性 / 三步教学 / 弹层键盘语义） | ✅ 完成，10 场景 104 断言 + 25 项全流程回归全过 |
| 阶段 5 | 现场展示优化 | ⬜ 待开始 |
| 阶段 6 | 多关卡 + 种子随机化（3 天 / 30 位 / oracle 单源判分） | ✅ 完成，本地 241 断言 + 47 单测 + 400×3 局分布抽样全过（§13） |

**当前阻塞：无。用户已授权按优先级连续推进（不再逐项确认），第五轮已交付并复验（§12），第六轮已交付（§13）。§6 中 ★2 已落地；★1/★3/★4/★5 涉及玩法数值与首屏信息取舍，仍按「需签字」保留。**

---

## 2. 本地运行

```bash
cd /Users/lusuallen/Downloads/ai-please
npm run dev        # → http://127.0.0.1:5173/
npm run build      # tsc --noEmit && vite build && postbuild
npm test           # 生成器 / 规则求值 / 存档 / 不变量（node --test）
npm run verify:budget   # 首屏 JS ≤70kB、全部 JS ≤74kB、总产物 ≤260kB
```

验收（需要先构建，再用 Pages 等价静态服务跑，别用 `vite preview`，原因见 §12.3 坑 1）：

```bash
npm run build
npm run serve:dist          # → http://127.0.0.1:4175/ai-please/
npm run verify:acceptance   # 10 场景，证据写 /tmp/ai-please-acceptance
```

技术栈：React 18 + TypeScript + Vite 5 + 纯 CSS。无后端、无数据库、无登录、无真实 AI API、无支付、无重型依赖（deps 仅 react / react-dom）。

---

## 3. 验证证据（全部为实测，非声明）

### 3.1 编译

```
$ npx tsc --noEmit
（无输出 = 0 错误）
```

### 3.2 端到端实机流程（headless Chrome 155 + CDP，真实 Input 事件）

390×844 / DSF 2 / iPhone UA：

| 检查项 | 结果 |
| --- | --- |
| 首页 → HOW TO PLAY → START GAME → 新手说明 | ✅ |
| 10 位访客顺序 V-001…V-010 | ✅ |
| 判定反馈盖章 10/10 CORRECT | ✅ |
| INSPECT 解封线索（第 5/7/9 位各 2 条） | ✅ |
| 结算：CORRECT 10/10 · INSPECT 3 · SCORE 1000 · FUNDS ¥2125 | ✅ |
| HUMAN MODE →「ENDING · 人文模式 / THE DOOR」 | ✅ |
| PLAY AGAIN 重置回 V-001 / ¥1000 / 0 分 | ✅ |
| 中途刷新 → 首页出现「RESUME · 第 02 / 10 位」 | ✅ |

**控制台错误 0 条 / 运行期异常 0 条。**

### 3.3 第二轮回归（本轮修复的专项断言）

| 断言 | 实测值 | 结果 |
| --- | --- | --- |
| 375×667 短屏，规则入口免滚动可达 | top 540 / bottom 584，视口 667，点击命中自身 | ✅ |
| 规则广播未确认时判定键是否锁定 | 三键 `disabled: [true,true,true]` | ✅ |
| 确认广播（ACKNOWLEDGE）后解锁 | `[false,false,false]` | ✅ |
| 广播条不再压住状态栏 | toast 起点下移到 `env(safe-area-inset-top) + 104px` | ✅ |
| 结算页最后一个按钮在首屏内 | BACK TO MENU top 786 / bottom 832，视口 844 | ✅ |
| 零值不再着色为红/绿 | WRONG `0` → `rgb(213,226,242)`（ink） | ✅ |
| 首页脚注对比度 | `rgb(124,142,169)` on `rgb(5,7,13)` = **6.04 : 1**，9px | ✅ |

### 3.4 布局与可达性（五视口实测）

| 视口 | overflowX | <40px 触摸目标 | 横向越界元素 |
| --- | --- | --- | --- |
| 320 × 568 | 0 px | 0 | 无 |
| 375 × 667 | 0 px | 0 | 无 |
| 390 × 844 | 0 px | 0 | 无 |
| 414 × 896 | 0 px | 0 | 无 |
| 1280 × 800 | 0 px | 0 | 无 |

灰阶三档对 `--bg #05070d`：`--ink #d5e2f2` / `--ink-dim #8698b3` / `--ink-faint #7c8ea9`（6.04:1，AA 小字阈值 4.5:1 通过）。

### 3.5 护照专项断言（`/tmp/cdp-passport.mjs`，29 项全过）

| 断言 | 实测值 | 结果 |
| --- | --- | --- |
| 打开放大层即为 FIT | `doc/body` ratio **1.000**，可整页读 | ✅ |
| 点 `ZOOM 1.6×` 后视觉比 | **1.600**，`scrollWidth 579 > clientWidth 362` 可横向滚动 | ✅ |
| `FIT` 一键复位 | ratio 1.000 且 `canScrollX=false` | ✅ |
| 两枚印章按钮首屏可点 | 各 52px 高，`elementFromPoint` 命中自身（390 与 320 均过） | ✅ |
| 盖章 → 反馈的顺序 | t≈320ms 反馈**未**出现；`appearAt = 920 / 938 / 942ms`（≡ `STAMP_MS 900`） | ✅ |
| 反馈出现后护照层卸载 | `.pp-sheet` 为 null，判定记账 `CORRECT` | ✅ |
| 印章对比度 | 绿 `#3ef08a`/`#0a2416` = **10.99:1**；红 `#ff5470`/`#230a11` = **5.82:1** | ✅ |
| 护照内页 / MRZ / 放大层横向溢出 | 均 0 px | ✅ |
| 控制台 | 0 error / 0 未捕获异常 | ✅ |

### 3.6 全流程回归（`/tmp/cdp-e2e.mjs`，14 项全过）

10 位访客全部走完并全部判对（V-001…V-010 CORRECT），**7 位走护照盖章、3 位走底部三键**，两条路径都真实点过；INSPECT 发生在第 5 / 7 / 9 位。到模式选择选 `HUMAN MODE` → 结算 `S · 边境之星 / 1000 分 / ¥2125 / THE DOOR`；`BACK TO MENU` 首屏可点；`PLAY AGAIN` 重置到 `V-001 / ¥1000 / 0`；刷新后首页 `RESUME · 第 02 / 10 位`。全程 `overflowX = 0`，无未捕获异常。

### 3.7 截图

`docs/shots/`（11 张，本轮护照 UI 重截，旧图已删）：01-home / 02-game-passport / 03-passport-fit / 04-passport-zoomed / 05-passport-stamped / 06-feedback / 07-game-inspected / 08-desktop-1280 / 09-narrow-320 / 10-mode-choice / 11-result。

---

## 4. 本轮已修复的缺陷（附根因）

| # | 缺陷 | 根因 | 修法 |
| --- | --- | --- | --- |
| 1 | 首页脚注、模式选择说明对比度仅 2.04:1，几乎不可读 | `.home-foot` 用了一档未被验收覆盖的 `#33445c` | 改用 `--ink-faint`、8px → 9px，实测 6.04:1 |
| 2 | 最暗灰在面板底色上只有 4.46:1 | 只对 `--bg` 测过，没对 `--panel #0b1220` 测 | `--ink-faint` `#6a7d99` → `#7c8ea9` |
| 3 | 规则入口在 375×667 / 320×568 落在首屏之外，玩家看不到规则书 | `.rule-toggle` 排在滚动区末尾 | 改 `position: sticky; bottom: -1px`，免滚动常驻 |
| 4 | 规则广播在 240ms 内被一次误触吞掉，且该周期不再出现，玩家信息不全被判错 | `NEXT` 直接用新 index 覆盖 `pendingUpdate` | 广播未确认时锁定三个判定键 |
| 5 | 规则广播条压住状态栏 22.5px，遮掉整条进度 pip | toast `top` 比状态栏高度小 | `74px` → `104px` |
| 6 | `INSPECT` 按钮写 `¥-25`（双负号），与反馈层 `−25` 不一致 | `FUNDS_TABLE.inspect = -25` 被直接拼进文案 | 改 `−¥${Math.abs(...)}` |
| 7 | 同屏 `UNVERIFIED`（tier）与 `INSPECTED`（开档状态）语义打架 | tier 标签把"未开档"和"访客类别"混成一个词 | `inspect` 档文案改 `DEEP CHECK` |
| 8 | 结算页 `BACK TO MENU` 被切掉半截（390×844 首屏看不到） | 8 个同权统计格 + 10 行流水把按钮顶出首屏 | 8 格压到 6 格，结论行（分数/结余）提级 |
| 9 | 零值被着色：`WRONG 0` / `误放行 0` / `误拒绝 0` 全红，`SCORE 0` 显绿 | 条件写成了 `>= 0` / 无条件下 `neg` | 改为 `>0` 才绿、`<0` 才红、`=0` 中性 |
| 10 | `ACCOUNT REGION` 在 320~414 五个视口全部换行，白吃一行高度 | key 列 82px + 字距 0.13em 放不下 14 字符 | key 列 88px、字距 0.08em |
| 11 | 规则摘要条曾占据整块剩余高度，渲染成一个空边框大盒子 | `.rule-toggle { flex: 1 }` 吸收剩余空间 | `flex: 0 0 auto` + `margin-top: auto` + `min-height: 44px` |

---

## 5. 已验证的设计决策

- **虚构区码**（KA-01 / NA-04 / OR-09 / VM-02 / AL-05 / TZ-07 / SG-03 / BX-12）替代真实国家，
  所有异常都能靠界面内的 REGION REGISTRY 表（CODE / REGION / TZ / LANG / ZONE）反推，不要求玩家猜。
- **数据与逻辑三层分离**：`src/data`（regions / rules / visitors）、`src/game`（engine / storage）、
  `src/hooks/useGame.ts`（单 reducer）。计分与资金只在 `src/game/engine.ts` 一处定义。
- **规则按索引生效**：R06 在第 4 位登场，开放区名单在第 7 位变更（TZ-07 移出 / SG-03 加入），
  R07 在第 9 位签发。

---

## 6. 待办（设计评审输出，按优先级；★ = 需要用户签字）

### P0 — 影响"3 秒讲清"与核心张力（未做，需签字）

| # | 问题 | 建议改法 | 成本 |
| --- | --- | --- | --- |
| ★1 | 首屏没有动词：最大的元素是标题，`APPROVE` / `DENY` 在首屏一次都不出现 | 标题下第一行改成「你是 04 号窗口的边境审核员」（14px `--ink`），第二行「核对 AI 服务申请 · 放行 或 拒绝」（动作词双色），加两枚静态印章 | 仅 `HomeScreen.tsx` + 字号 |
| ★2 | 点 START 立刻撞上 6 步文字墙 | ✅ **已落地**：压到 3 步 + 上一步回看 + 跳过说明 + 首页上下文收尾文案（本轮 §12.1） | 仅 `TutorialSheet.tsx` |
| ★3 | 两个道德难题被线索直接写了结论（V-007「非申请人行为导致」、V-010「优先级高于 R01」） | 线索只给事实，判断留给玩家 | 仅 `visitors.ts` 两句话 |
| ★4 | 结算页 8 格诊断信息压在结局之上 | 顺序改为 评级 → 结局卡（主角，标题 12→20px）→ 4 格数字 → 流水折叠 → 按钮 | `ResultScreen.tsx` |
| ★5 | 资金只增不减（判对 +120、唯一支出 ¥25），最优解是"每单都开档"，取舍消失 | 改成 10 次开档额度（QUOTA），或删掉第二货币只留分数 | 改 `engine.ts` 数值语义 |

### P1 — 一致性与可达性（可做，风险低）

| # | 问题 | 建议 |
| --- | --- | --- |
| 6 | 全站字号 13 档、字距 14 种、间距 15 种、硬阴影 3 级 | 收敛到 字号 6 档 / 字距 4 档 / 间距 5 档 / 阴影 2 档 |
| 7 | 每局重复 10 次的 `SCORING TABLE` 与 `JUDGEMENT BASIS` 抢同一权重 | 只在第 1–2 位展示；腾出的空间给"下次怎么防"的针对性提示 |
| 8 | `YOU: / REQUIRED:` 这行是复盘唯一关键信息，却是 9px 最暗灰 | 提到 11px + `--ink-dim` |
| 9 | 异常摘要与字段行分离，玩家要跨面板心算 | `info-row` 增加"已标记"变体（左侧 3px 琥珀条） |
| 10 | 开档看不到"标准时区 / 标准语言"对照，每次要开抽屉翻注册表 | 开档后 DEEP FILE 加两行对照——这才是 ¥25 该买到的东西 |
| 11 | 结算流水 10 行全绿，看不出错在哪 | 错行整行加底色 + 左侧竖条 |
| 12 | 320 下访客卡标题换行、按钮副标签贴边 | ✅ 已修：标题 `nowrap + ellipsis`，`@media(max-width:360px)` 隐藏 `.pp-tier`（320/360/375/390/414 标题高均 14px） |

### P2 — 打磨

13 桌面端内容区滚动无提示（仅演示用）· 14 密封态 DEEP FILE 只为一行提示（现已随剩余高度自适应，`max-height:168px`）· 15 ✅ 新手说明已有「跳过说明 / 上一步」（本轮）· 16 ✅ `STAMP_MS` 已复活（`engine.ts:18` → 盖章到反馈的 900ms 间隔，实测 920–942ms）。

---

## 7. 已知限制

| 限制 | 影响 | 处置 |
| --- | --- | --- |
| `git` 只能走 `/Applications/Xcode.app/Contents/Developer/usr/bin/git`（`/usr/local/bin/git` 报 Bad CPU type，`/usr/bin/git` 被 Xcode license 拦） | 直接敲 `git` 会失败 | 已在 §11/§12 的命令里显式指定该路径 |
| headless 下 `env(safe-area-inset-*)` 恒为 0 | 刘海屏与底部手势条未实测 | 布局已用 `env()` 兜底，需真机复核一次 |
| 320×568 主内容区需要滚动 | 主操作按钮仍常驻吸底 | 可接受 |

---

## 8. 下一步

1. 用户对 §6 的 ★1–★5 签字 → 我按优先级落地并逐项复验。
2. P1 的 6–12 可随时批量做（纯 CSS / 呈现层，不碰玩法数值）。
3. 阶段 5：首屏 3 秒讲清玩法、失败也可展示的引导。

---

## 9. 需求评审：护照场景（VISITOR PASSPORT）

> 评审日期 2026-10-24 · 对象：新增需求「护照拿过来看 → 放大 → 盖章放行/拒签」· 结论：**有条件通过**，条件见下方 P0。

### 9.1 判断汇总

| 问题 | 判断 |
| --- | --- |
| 解决什么 | 只解决「判定没有对象、执行章与审计章混为一谈」。**不解决** 3 秒认知（它发生在 START 之后），**不解决** 信息可得性（8 行表格已给全） |
| 字段 | 必上 5 项：V-code+中文名 / IP REGION / TIMEZONE / ACCOUNT REGION / LANGUAGE；REASON 必须同屏；DEVICE+SUBMITTED 禁止上 |
| 入口 | 叠加，不二选一。入口 = VisitorCard 现有的 `FILE SEALED/OPEN` 标签就地改名；判定入口仍只有底部三键；护照章位**只读** |
| 删什么 | `APPLICATION DATA` 整块消失（8 行 → 0）、`DEEP FILE` 密封态 80.6px → 44px、反馈层 `SCORING TABLE` 删除。净省约 150–190px |

### 9.2 它到底解决什么（对比论证）

现状证据：

- **判定入口只有一个，且在吸底栏**：`src/components/ActionBar.tsx:13-38`，三键固定底部，`disabled` 绑定 `phase!=='playing' || pendingUpdate!==null`（`src/screens/GameScreen.tsx:106`）。所以游戏屏不缺动词——缺动词的是首页（见 §6 ★1，`docs/shots/01-home.png` 首屏 APPROVE/DENY 零出现）。
- **盖章已经存在**：`src/components/FeedbackOverlay.tsx:26` 已有一枚旋转大章 `CORRECT`/`WRONG`。再加一枚同义章 = 纯装饰层。
- **真正的缺陷在语义**：同一屏里 `CORRECT`（系统对我的审计）与 `YOU: APPROVED · REQUIRED: APPROVE`（我的执行）并置，章又盖在访客 `V-001` 标签下方（`FeedbackOverlay.tsx:21`）。错判时 `WRONG` 会被读成「这个人被拒了」。

所以护照场景唯一成立的价值是：**把「我对他做的决定」做成一个有对象、有落点的动作，并把执行章与审计章拆成两个物理对象。** 其余叙事收益（放大的仪式感、翻页质感）都是装饰。

推论：护照一旦复述 `APPLICATION DATA` 的字段而不删该面板，它就是第三套重复信息——这是通过与否的唯一开关。

### 9.3 字段清单

判据：只收参与 R01–R07 判定的操作数（`src/data/rules.ts`）。

| 级别 | 字段 | 理由 |
| --- | --- | --- |
| P0 必上 | V-code + 中文名 | 章必须有对象 |
| P0 必上 | IP REGION（码+区名） | R01、R03 基准 |
| P0 必上 | TIMEZONE | R02 |
| P0 必上 | ACCOUNT REGION | R03 |
| P0 必上 | LANGUAGE | R04 |
| P0 同屏 | REASON | R05 的操作数对是 SERVICE↔REASON，拆到两屏即失效 |
| P1 可上 | SERVICE 单行徽标 | 与 REASON 同屏才成立 |
| P1 可上 | alias 英文名 9px | 身份感，不得单独占行 |
| 禁止 | DEVICE / SUBMITTED | R06 操作数，INSPECT 之后才判，应进 DEEP FILE |
| 禁止 | 护照号 / 签发机关 / 有效期 / 出生日期 / 钢印 / 纹样 | 不对应任何规则，纯占高 |

四个必上字段是短值，正好排成护照内页的 2×2 对照块（MRZ 式）——这是护照母题本身，不是额外装饰。

### 9.4 入口与底部三键的关系

**叠加，硬分工：读在护照，判在三键。**

- 入口不新增按钮：`src/components/VisitorCard.tsx:46` 的 `FILE SEALED / FILE OPEN` 标签就地改为 `PASSPORT ▸ / PASSPORT ◂`。现有同义状态标签已有 3 处（tier、FILE、INSPECTED/SURFACE ONLY），本次收敛成 1 处。
- 护照内页右下两个虚线空框 `APPROVE` / `DENY`，标 `NOT STAMPED`，**不可点**（`disabled` + `aria-disabled`，无 pointer）。理由：第二个判定入口会把 §3.3 的「广播未确认锁三键」契约复制一份，是 bug 温床；且中屏按钮违反单手热区。
- 盖章：按底部三键 → 护照展开时内页落一枚实心章（400ms）→ 反馈层出审计章。护照合上则跳过执行章。**纯 CSS 动画，不新增 state phase**。
- 两枚章必须可分：执行章 = 护照内页、实心方框、无旋转、`APPROVED`/`DENIED`；审计章 = 反馈层、描边+旋转、`CORRECT`/`WRONG`（现状保留）。
- 默认态：进入每位访客自动播放「合上→翻开」200ms，之后保持展开，可手动合上。信息默认可见，不做二次点击门槛；「拿过来看」的身体感由入场动画承担，交互成本为零。

### 9.5 为容纳它要删什么（高度账，390×844 / DSF2 实测估）

| 模块 | 现状 | 改造后 | 差 |
| --- | --- | --- | --- |
| VisitorCard（封面态） | ~118px | 并入护照 | — |
| APPLICATION DATA（8 行） | ~263px | 0（整块删除） | −263 |
| 护照内页（新） | — | ~226px | +226 |
| DEEP FILE 密封态 | 80.6px | 44px 单行条 | −37 |
| **净** | | | **约 −155 ~ −190px** |

腾出的空间同时消化 §6 P0 ★5 的额度条与 P2 #14，不需要再加滚动。

### 9.6 P0 / P1 落地项

P0（不满足即等于「只是加了一层」，不予通过）

1. 护照吸收 `APPLICATION DATA`，禁止新增独立面板（第三套信息的唯一开关）。
2. 章位只读，判定入口唯一（底部三键）。
3. 执行章 / 审计章视觉与文案可分。
4. 护照字段严格限定 §9.3 的 P0 集合，R06 操作数不得上护照。
5. 验收断言：320×568 下护照展开后 `RULE TOGGLE` 免滚动可达（沿用 §3.3 口径）；`GameState` 新增的 `passportOpen` 不得写入 `SavedRun`（`src/game/storage.ts:6-12` 只存 index/score/funds/inspectedCount/records），刷新回落默认态，零迁移。

P1

6. 首页静态护照封面（真正的 3 秒认知正解）：复用同一组件在 `HomeScreen` 做静物，封面 + 两枚章位，标题下补「核对照 · 盖章放行或拒签」。
7. `ANOMALY SCAN` 行内化：信号标记并入护照字段行（合并 §6 P1 #9），有信号时省约 90px。
8. 反馈层 `SCORING TABLE` 删除（合并 §6 P1 #7）。

不引入新依赖：护照 = 现有 `.panel` 边框/硬阴影 token + `PixelAvatar` + CSS。

### 9.7 风险

| 风险 | 处置 |
| --- | --- |
| 默认展开后「拿过来看」的动作消失 | 由入场翻页动画承担，不靠点击 |
| 两枚章同屏被读成重复 | 位置/颜色/文案三处差异化，且执行章先于审计章 400ms 出现 |
| 320×568 已需滚动，护照高 1px 即挤出规则入口 | P0 断言锁死，实测 top/bottom |

---

## 10. 实现记录：护照 GUI（2026-10-24 第三轮）

> 需求原文（用户）："如果能多一点 GUI 比如有个场景签证官把护照拿过来看，放大查看护照并盖章或者拒签，会更好。目前的信息很拥挤，但是也挺合适的"
> 结论：**已落地并实测**。行为与两位专家规格（§9 / `docs/design/passport-sheet.md`）有 4 处差异，差异与理由见 §10.3。

### 10.1 改了什么

| 文件 | 动作 | 说明 |
| --- | --- | --- |
| `src/components/PassportDoc.tsx` | 新增 | 护照内页，**同时取代旧的 VisitorCard + InfoGrid**（两文件已删除）。头部含 tier 标签与 `PASSPORT ▸` 入口；2×2 判定字段（IP REGION / TIMEZONE / ACCOUNT REGION / LANGUAGE，各带 `per R02/R04` 依据）；DECLARED REASON；两枚虚线章位；MRZ；底注 |
| `src/components/PassportZoom.tsx` | 新增 | 放大层（`z-index: 68`）。默认 **FIT 1.0**，点文档按点击点放大到 **1.6×**，再点复位；`ZOOM 1.6× / FIT`、`CLOSE`、Esc 关闭；底部两枚 52px 印章 `STAMP · APPROVE` / `STAMP · DENY` |
| `src/data/passport.ts` | 新增 | `derivePassport(visitor)` 确定性派生护照号 / 签发地 / 有效期 / 历史章；**只读 `avatarSeed` 与 `accountRegion`，不读 `correct` / `signals`** |
| `src/screens/GameScreen.tsx` | 改 | `handleStamp(move)` 立刻 `onMove(move)` 记账（分数仍由 `engine.ts` 单一来源算），`setTimeout(STAMP_MS)` 后再关浮层 → 先看章、后看反馈；`RuleToggle` 移出 `<main>` |
| `src/styles/global.css` | 改 | 追加约 400 行：`.pp-*` 内页、`.pp-overlay/.pp-sheet/.ppz-*` 放大层、`.deep-panel`；`.rule-toggle` 改为 stage 常驻行 |
| `src/game/engine.ts` | 无改动 | `STAMP_MS = 900` 由死代码变成流程常量 |

### 10.2 为什么这样切

- **护照吸收 APPLICATION DATA，而不是新增面板**：CPO 的 P0 条件。旧 `VisitorCard + InfoGrid + APPLICATION DATA` 三块被一块护照内页取代，信息总量没增加，屏幕反而腾出高度。
- **DEVICE / SUBMITTED 下沉到 DEEP FILE**：这两项是 R06 的操作数，属于"开档才该看到"的信息；放在护照上等于把 ¥25 的取舍提前送人。
- **章在护照里，不在反馈里**：用户要的动作是"盖章/拒签"这个物理动作。判定仍写进同一份 `record`，所以计分逻辑零分叉。
- **默认 FIT 而不是 1.6×**：1.6 默认会让文档右侧被裁，第一眼像坏了；先把整页给玩家，再让他自己决定要不要放大。
- **先章后反馈**：`STAMP_MS 900` 间隔让"盖章生效"有落点；实测反馈在 920–942ms 出现，不与落章动画抢同一帧。

### 10.3 与专家规格的 4 处差异（有据）

| # | 规格要求 | 实际做法 | 理由 |
| --- | --- | --- | --- |
| 1 | 护照作为浮层（`.pp-sheet` 358×620） | 内页 **inline 常驻**，放大才用浮层 | CPO 只否决"新增第三套信息"，inline 已经满足；常驻还省一次点击，且解决"信息很拥挤"的诉求 |
| 2 | 章位**只读** | 章位可点，直达放大层盖章 | 用户原话明确要求"盖章或者拒签"，交互入口保留 |
| 3 | 默认 1.6× 放大 | 默认 FIT 1.0，点击放大 | 1.6 默认裁切右半边，首屏读不全 |
| 4 | `.rule-toggle` 留在 main 内 sticky | 移出 main，成为 stage 常驻行 | sticky 在内容长时会压住 DEEP FILE 最后一行线索（1280×800 实测可见），移出后**永不遮挡** |

### 10.4 证据

`npx tsc --noEmit` 0 错误；`npm run build` 成功（51 modules，CSS 22.32 kB / gzip 5.22，JS 181.70 kB / gzip 59.81）。
护照专项 29 项、全流程回归 14 项断言全过，明细见 §3.5 / §3.6；复跑命令：

```bash
node /tmp/cdp-passport.mjs   # 29 passed / 0 failed
node /tmp/cdp-e2e.mjs        # 14 passed / 0 failed
```

### 10.5 剩余风险

| 风险 | 说明 |
| --- | --- |
| 真机 `env(safe-area-inset-*)` 未实测 | headless 下恒为 0；布局已用 `env()` 兜底 |
| 320×568 首屏需滚动 | 护照内页在 320 下需纵向滚动才能看到 MRZ；判定栏与章位仍常驻 |
| 1280×800 桌面演示需滚动 | 舞台 9:16 被视口高度限制，内容区滚动；仅演示场景 |
| 护照号为派生值 | 与访客数据同源（`avatarSeed`），不参与任何判定，避免"看起来像线索"的误导 |

---

## 11. 上线记录：GitHub Pages（2026-10-24 第四轮）

**线上地址：https://lusuallen.github.io/ai-please/**（项目页；与个人站 `lusuallen.github.io` 根域共存，互不影响）

### 11.1 发布链路

| 环节 | 配置 |
| --- | --- |
| 生产 base | `/ai-please/`（`vite.config.ts` 按 `command` 切换，dev 仍是 `/`） |
| SPA 刷新回退 | `scripts/postbuild.mjs` 把 `dist/index.html` 复制成 `dist/404.html` |
| Jekyll 拦截 | `scripts/postbuild.mjs` 写 `dist/.nojekyll` |
| 源码映射 | `build.sourcemap: false`（线上不带 `.map`） |
| 自动发版 | `.github/workflows/deploy.yml`：push `main` → `npm ci` → `npm test` → `npm run build` → `npm run verify:budget` → `upload-pages-artifact` → `deploy-pages` |
| 门禁口径 | 单测 56（生成器/评分器/存档/不变量/展示预算/关卡配方）、生成快照双轨：冻结区 D01–D03 **72 组恒等** `6ea6656d4ab9ad0e` + 配方区单独汇总（第十轮起，加关不再污染旧哈希）、预算四行：首屏 JS 70kB / 首屏 CSS 6.2kB / 全部 JS 74kB / 总产物 260kB |
| 验收口径 | 本地与线上都跑 `scripts/verify-v3.mjs`（19 场景 / 339 断言，断言只增不减，`runtimeErrors=0`） |
| Pages 开通 | `actions/configure-pages@v5` + `enablement: true`（首次用工作流 token 自动开通，无需网页点击） |
| 首次发布 | Actions run **#1 success**，`https://api.github.com/repos/LuSuAllen/ai-please/pages` 创建返回 201，`build_type=workflow` |

### 11.2 线上验收（在 `https://lusuallen.github.io/ai-please/` 真实地址上跑，不是本地 preview）

| 断言 | 实测 | 结果 |
| --- | --- | --- |
| `location.origin` | `https://lusuallen.github.io` | ✅ |
| 首页渲染 | `.home-kicker` 命中 | ✅ |
| 资源 200 且同源 | `/ai-please/assets/index-B9MM_T1v.js` 200 `application/javascript`、`/ai-please/assets/index-kDIcALA7.css` 200 `text/css` | ✅ |
| 深链接刷新 | `/ai-please/some/deep/route` 返回 404 状态但内容与首页字节一致（404.html 回落） | ✅ |
| 根路径跳转 | `https://lusuallen.github.io/ai-please` → 301 → `/ai-please/` | ✅ |
| 全流程 | 10 位访客全判对；7 位走护照盖章 / 3 位走底部三键 → `HUMAN` → `S · 边境之星 / 1000 / ¥2125 / THE DOOR` | ✅ 14/14 |
| 存档 | `localStorage` 写入 `["ai-please:meta:v2","ai-please:run:v2"]`；刷新 `RESUME 第 02 位` | ✅ |
| 移动端 | 390×844 `overflowX = 0` | ✅ |
| 干净度 | 0 网络失败、0 console error、0 未捕获异常 | ✅ |

线上冒烟合计 **13 项**、线上全流程回归 **14 项**，全绿。
截图 `docs/shots/12-live-production.png` 为线上真地址实拍。

### 11.3 运维事实

- **发版方式**：`git push origin main` 即自动构建发布（约 40–70 秒）。
- **回滚**：`git revert <commit> && git push`，或 Actions 页面 re-run 上一个成功部署。
- **存档隔离**：换域名 = 换 origin，`127.0.0.1:5173` 的本地存档不会带到线上（浏览器同源策略）。存档 key 带 `:v2` schema 版本，结构升级不会读坏旧档。
- **本地预览线上形态**：`npm run build && npm run preview` → `http://127.0.0.1:4173/ai-please/`。

### 11.4 已知限制

| 限制 | 说明 |
| --- | --- |
| 首次发布前无任何凭据 | 本机两个旧 token 已吊销（API 401），最终由用户提供 PAT 完成首推；**上线后建议 Revoke 该 token** |
| 无自定义域名 | 当前用项目页路径；若要 `ai-please.allen-diginet.com`，需在 DNSPod 加一条 CNAME → `lusuallen.github.io`，并在 workflow 的 `configure-pages` 补 `cname` |

---

## 12. 实现记录：第五轮（存档公平性 / 三步教学 / 无障碍）

> 用户授权（2026-10-24）：「按照优先级逐步推进，不需要找我确认，除非遇到阻塞项关键问题」。本轮按 CPO / CTO / 验收测试工程师 三方结论落地，不再逐项确认。

### 12.1 改了什么

| # | 问题（证据） | 改法 | 文件 |
| --- | --- | --- | --- |
| 1 | 刷新回到首页后，`hasSave` 用 `run.index > 0` 判断 → **第 1 位开档后刷新，RESUME 入口消失**，而存档其实在 | 判定改为 `run.index >= 0 && run.index < 10`，首页按真实存档状态出 `RESUME · 第 01 / 10 位` | `src/App.tsx` |
| 2 | 存档写失败时玩家毫不知情，刷新就丢进度 | `storage.ts` 增加 `StorageFailure` + 订阅；`useGame` 用 `useSyncExternalStore` 暴露 `storageFailure`；`App` 顶部渲染 `role="status"` 提示「本局尚未保存」 | `src/game/storage.ts`、`src/hooks/useGame.ts`、`src/App.tsx`、`src/styles/global.css` |
| 3 | `clearStorageFailure()` 无差别清除 → **删除失败被随后一次成功的写入"洗白"**，提示消失（验收场景 7 复现） | 清除按操作作用域：`clearStorageFailure('write' \| 'delete')` 只清同名操作 | `src/game/storage.ts` |
| 4 | 广播确认状态、INSPECT 状态、结尾选择在刷新后丢失，可重复收费/重复判定 | 存档扩展 `phase / inspected / seenUpdates / pendingUpdate / lastRecord`；旧 v2 存档缺字段按兼容推断；`index === 10` 或 `records.length === 10` 恢复为 `verdict` | `src/game/storage.ts`、`src/hooks/useGame.ts` |
| 5 | 6 步文字墙 + 无跳过 + 无回看 | 压到 3 步，加 `上一步 / 跳过说明`，收尾文案按上下文（`context: 'home' \| 'game'`）分别为「返回首页 ▸ / 开始审核 ▸」 | `src/components/TutorialSheet.tsx`、`src/screens/HomeScreen.tsx`、`src/screens/GameScreen.tsx` |
| 6 | 弹层无 `role="dialog"`、无焦点陷阱、Tab 可跑出弹层、Escape 行为不一致 | 新增 `useModalA11y`（按 **computed z-index + DOM 顺序**选最上层，70/80/68 三档命中）；护照、规则抽屉、反馈、立场选择、教程统一接入；Escape 只对可关闭层生效，关闭后焦点回到开启者 | `src/hooks/useModalA11y.ts` + 5 个弹层组件 |
| 7 | 护照「章位」原是不可聚焦的展示块，键盘用户无法查看护照；语义上像"点一下就等于放行" | 章位合并为一个语义化 `<button aria-label="查看护照详情">`，只负责打开护照；放行/拒签仍必须走 `STAMP · APPROVE / DENY` | `src/components/PassportDoc.tsx` |
| 8 | 护照内小控件 < 44px | 补 `min-height: 44px` + 像素风 `:focus-visible` 描边 | `src/styles/global.css` |

### 12.2 验收证据（全部为本轮实跑输出）

**A. 独立验收脚本 `scripts/verify-next-version.mjs`（Node 22 + 无依赖 CDP，隔离 profile，真实鼠标/键盘事件）**

```text
node scripts/verify-next-version.mjs --url http://127.0.0.1:4175/ai-please/ --out /tmp/ai-please-qa-final2
PASS broadcast-3-6-8-real-journey-refresh-ack
PASS inspect-first-visitor-refresh-no-double-charge
PASS last-visitor-refresh-ending-STRICT
PASS last-visitor-refresh-ending-HUMAN
PASS storage-getItem-failure-visible-no-white-screen
PASS storage-setItem-failure-visible-no-white-screen
PASS storage-removeItem-failure-visible-no-white-screen
PASS stamp-slots-enter-space-dialog-focus
PASS feedback-modal-focus
PASS tutorial-modal-focus
PASS: 10/10 scenarios; evidence: /tmp/ai-please-qa-final2
```

`test-results.json`：`status=PASS`、`exitCode=0`、**104/104 断言通过**、`runtimeErrors = 0`、24 张 PNG。

覆盖点：第 3/6/8 位广播在**未 ACK 刷新后仍在**且三键锁定、ACK 后不重复弹出且只记一次；第 1 位开档只扣一次 ¥25 且刷新后不重复收费/计数；末位访客刷新不得重放 V-010（STRICT 与 HUMAN 两条结局都测）；getItem/setItem/removeItem 三种注入故障下不白屏且有可见提示；章位 Enter/Space 打开护照且**不产生判定**；护照/抽屉/反馈/教程四类弹层的 `role=dialog` + 焦点陷阱 + Escape + 焦点归还。

**B. 全流程真实playthrough（390×844 / DSF2 / iPhone UA，`/tmp/e2e-final.mjs`）**

```text
PASS: 25/25 checks
```

| 断言 | 结果 |
| --- | --- |
| 教程 01/03 → 02/03 → 回看 01/03 → 03/03「返回首页」 | ✅ |
| 开局 `VISITOR 01/10 · FUNDS ¥1000 · SCORE 0` | ✅ |
| V-001…V-010 十次判定全 CORRECT（5 次走护照盖章、5 次走底栏按钮） | ✅ 10/10 |
| 结算 `S · 边境之星 / 10/10 / ¥2125 / HUMAN · THE DOOR`，审核流水 ≥10 行 | ✅ |
| `PLAY AGAIN` 回到 `01/10 · ¥1000 · SCORE 0` | ✅ |
| 刷新首页出现 `RESUME · 第 02 / 10 位` 并正确续到 02/10 | ✅ |
| 390 视口横向溢出 / <32px 触摸目标 / console 错误 | `0 / [] / []` |

**C. 构建门禁**

```text
npm run build   # tsc --noEmit && vite build && node scripts/postbuild.mjs
✓ 52 modules transformed.
dist/index.html 0.57 kB · css 22.95 kB (gzip 5.41) · js 186.09 kB (gzip 61.38)
[postbuild] dist/404.html + dist/.nojekyll 就位
```

### 12.3 本轮踩过的坑（留给下一次）

1. **`vite preview` 不能当作 Pages 验证环境**：`/ai-please/assets/*.js` 被回退成 `index.html` 且 `Content-Type: text/html` → 浏览器不执行 JS，10 个场景统一超时。正确做法是用静态映射服务把 `/ai-please/` 映射到 `dist`（本轮用 `:4175`），再跑验收。
2. **验收脚本自身的 `wait()` 返回 DOM 节点**时，CDP `returnByValue` 会报 `Object reference chain is too long`。`wait()` 必须 `!!(expr)` 归一成布尔。
3. **CDP 的 Enter/Space 不带 `text` 不会触发按钮默认行为**，必须带 `text: '\r' / ' '` + `unmodifiedText`，否则会误判"键盘不可用"。
4. **注入式 `localStorage.clear()` 在每次新文档都会执行**，会把刷新恢复场景假阳性化；必须用 `sessionStorage` 标记只播种一次。
5. 三条断言失败里，只有「removeItem 失败提示消失」是真业务缺陷（见 12.1 #3），另外两条是脚本缺陷——**失败先 dump 证据再改代码**。

### 12.4 线上验收（在真实地址上跑，不是本地）

提交 `6468959` 推送到 `main` → `deploy.yml` 自动重建 → 线上 HTML 已换成新产物 `assets/index-BDCfSyiQ.js`（轮询 4 次命中，约 40s）。

同一套脚本在 **`https://lusuallen.github.io/ai-please/`** 上重跑：

```text
PASS: 10/10 scenarios  (104/104 断言, runtimeErrors=0)   → /tmp/live-qa
PASS: 25/25 checks                                        → /tmp/live-e2e
```

线上证据图：`docs/shots/16-live-round5.png`（线上跑完 10/10 的结算页）。

### 12.5 线上地址

`https://lusuallen.github.io/ai-please/`（部署链路见 §11）

---

## 13. 实现记录：第六轮（多关卡 + 种子随机化，2026-10-24）

**需求出处**：用户原话「关卡更多更随机，现在都是固定的，并且只有 10 人」（@CTO @CPO）。CPO 出取舍文档、CTO 出工程规格（`docs/design/levels-random.md` / `docs/design/levels-random-cto.md`），冲突处以 CTO 规格为准。

### 13.1 交付内容

| 维度 | 之前（第五轮） | 现在（第六轮） |
| --- | --- | --- |
| 阵容 | 硬编码 10 位，常量 `VISITORS` | 生成器按 `seed + dayId` 现算，3 天共 30 位（8 / 10 / 12） |
| 判定来源 | 模板里手写 `correct` | 唯一来源 `src/game/rules-eval.ts` 的 `evaluateVisitor()`（oracle），生成期算出并写入快照 |
| 可玩内容 | 10 位固定访客 | 14 个访客模板 + 6 张手工卡（3 特殊 / 3 冲突），按蓝图配额与难度权重随机组合 |
| 规则变更 | 固定 `atIndex 3/6/8` | 由蓝图 `events` 驱动：R06 上线、开放区名单变更、特赦窗口、R07 紧急豁免令 |
| 存档 | `run:v2` 单局 | `run:v3` 存整局快照（含 run/index/score/funds/records/seenUpdates），v2 旧档自动迁移成 D00 可续玩 |
| 关卡推进 | 单局 10 位 | D01 通关解锁 D02，D02 通关解锁 D03；`bestByDay` 按天记录最高分 |
| 评分 | 固定阈值 | 不变式保留（`gradeOf(score,total)`），错判惩罚上调至 `wrongApprove -150`，让"准确率主导"落地 |

**三个关卡蓝图**（`src/data/levels.ts`）：

| 天 | 人数 | 配额 N/D/A/I/S/C | 事件 |
| --- | --- | --- | --- |
| D01 · 首日窗口 | 8 | 3/1/2/1/1/0 | R06 上线 @4 |
| D02 · 名单变更 | 10 | 3/2/3/1/1/0 | R06 @3、开放区变更 @7（开 SG-03 / 关 TZ-07） |
| D03 · 特赦日 | 12 | 3/2/4/1/1/1 | R06 @3、特赦 @5（窗口 3 位）、名单变更 @6、R07 豁免令 @8 |

### 13.2 生成流水线（`src/game/generator.ts`）

1. `masterSeed(dayId, seed)` → 命名子流 `fork('slots' / 'slot-N' / 'name-N')`。生成路径禁 `Math.random` / `Date.now`：`grep -rn "Math.random\|Date.now" src/game src/data` 只命中 `rng.ts:3` 的一句注释；随机种子只在 `src/hooks/useGame.ts:191` 用 `crypto.getRandomValues` 抽一次，不参与阵容生成。
2. 蓝图 → 槽位配额 → 卡片槽（S/C）优先落位 → 剩余槽位按模板池洗牌填充，排布 `maxPlacementTries=40` 次重试；若蓝图带 `zoneChange`，A 类槽位优先挑 A-ZONE，保证名单变更后立刻遇到"该区已关闭"的现场。
3. 每槽位物化草稿（`maxSlotRetries=8` 次），重试时避开最近 6 位用过的模板、相邻位不同模板、相邻位不同 IP 地区/服务，`avatarSeed` 与 `fingerprint` 局内唯一 → oracle 复算 → `validateRun()` 校验 → 整局失败则换子流重试（`maxRunRetries=4`）→ 仍失败降级到 `D00`（不允许白屏）。
4. 反重复指纹：`fingerprint = hash32(地区|时区|语言|账号区|服务|模版|线索)`，用于同局去重与"同 seed 同指纹"验收。

### 13.3 验证证据（全部为实测）

**A. 单测（node --test，10 个套件）**

```text
$ npm test
ℹ tests 47   ℹ pass 47   ℹ fail 0
```

覆盖：`rng`（向量/分支/shuffle 稳定性）、`zones`（名单变更时点、特赦窗口、R06/R07 生效区间）、`rules`（规则装配与广播文案）、`evaluator`（R01–R07 + 特赦 + 维护豁免 + AMBIGUOUS + 时区差）、`generator`（同 seed 幂等、不同 day 必不同、指纹唯一、配额精确、无禁词）、`solvability/invariants`（3 天 × 40 seed 全过 `validateRun`）、`storage`（v3 读写、20KB 预算、写失败可见）、`legacy`（D00 逐字段相等）、`distribution`（通过率区间）、`perf`（p95 ≤16ms）。

**B. 10000 局压力取证（DOD 要求）**

```bash
$ npm run stress
runs=10000 failures=0 p50=0.16ms p95=0.30ms p99=0.56ms
perDay=D01:3334 D02:3333 D03:3333
```

每局都跑 `validateRun()`：oracle 复算一致、配额、`requiresInspect` 必带 warn/alert 信号、判定前可见文本禁词零命中、事件索引/时点自洽、单局指纹唯一、通过率落在 `[0.45, 0.68]`。

**C. 分布抽样（400 seeds/天）**

```text
D01 fail=0 approve=0.625 inspectAvg=1.71
D02 fail=0 approve=0.600 inspectAvg=1.66
D03 fail=0 approve=0.550 inspectAvg=1.63 inspMax=3
```

模板覆盖：D03 的 3 张冲突卡各自 100–198 次、2 张特殊卡 191–209 次，说明卡池真的在轮换，而不是被前置槽位吃满。

**D. 构建与预算门禁**

```text
$ npm run build
dist/index.html 0.57 kB · assets/index-C53IDwrW.js 208.48 kB │ gzip: 69.99 kB
dist/assets/run-d00-*.js 5.3 kB （按需 chunk，只迁移 v2 旧档时才拉）
$ npm run verify:budget
首屏 JS   69.88kB / 70kB   (99.8%)
全部 JS   72.76kB / 74kB   (98.3%)
总产物    243.08kB / 260kB  (93.5%)
✔ 预算门禁通过
```

两个数字都记下来：Vite 自报 gzip 69.99kB，zlib level 9 实测 69.88kB，门禁以后者为准（更接近 CDN 实际压缩）。余量只剩 ~0.1kB，**下一轮加功能必须同时做减法**。

**E. 端到端验收（本地 Pages 等价服务，390×844 DSF2 + 320×568）**

```text
$ npm run build && npm run serve:dist
$ npm run verify:acceptance
PASS: 10/10 scenarios; 241 assertions; runtimeErrors=0  → /tmp/v3-evidence3
```

场景清单：D01 全程按 oracle 判定（含故意判错一次验审计层）、通关解锁 D02 并清档、D02 广播锁操作且刷新后仍生效、INSPECT 只扣一次费并解封线索、v2 旧档迁移成 D00、未解锁的天数不可点且按天记最高分、localStorage 写失败有可见提示不白屏、D03 在 320px 无横向溢出、五个弹层焦点陷阱与焦点归还、D03 全天无答案泄漏（判定前 DOM 不含 explanation / hiddenClues）。

### 13.4 本轮的设计取舍与偏离（都写在这里，别猜）

1. **S-FALSE-POSITIVE 不再依赖 `blacklistRevoked` 广播**：CTO 表格要求它绑定一条撤销公告，但那需要扩 `GameEvent` 联合类型并在蓝图里补事件。实际做法是把"该条目今天已撤销"做成开档线索（`hiddenClues`），事实字段保持干净（APPROVE、无需开档也可判对，开档只是确认）。好处：D01/D02 也能用这张卡；代价：少了一次广播教学。**这是对规格的有限偏离，已在此登记。**
2. **D00 旧档快照改成按需 chunk**：把 10 位访客整体塞进首屏会让 gzip 超 70kB（实测 +1.83kB）。改成 `await import()` 后首屏 69.88kB，只有存在 v2 旧档时才会拉那个 chunk。代价：迁移路径多一次异步。
3. **URL `?day=&seed=` 不再覆盖已有存档**：验收脚本需要它，但玩家刷新页面时不能因为一个分享链接就把进度清掉。现在只有"没有可续玩进度"时才自动开局（`hasResumableSave()`）。
4. **R07 只豁免 R01**：CTO 原文是"边境通行豁免"，CPO 的冲突卡 D3 又要求"豁免只覆盖开放区检查、时区错仍要拒"。按后者落地：R07 生效后 BX-12 的 R01 违规被豁免，R02–R06 照常判。
5. **`ending.ts` 迁出并去掉写死的 V-007/V-010**：文案改为读本局 `total/correct/inspectedCount/exemptApproved`，否则 8/10/12 人的局会说出错误编号。

### 13.5 本轮踩过的坑

1. **`node --test` 跑 `.ts` 必须给相对导入补 `.ts` 扩展名**（`--experimental-strip-types` 不做无扩展名解析），但 `src` 里原有代码全是无扩展名。做法：给值导入补 `.ts`，`import type` 保留原样（会被擦除）。tsconfig 的 `allowImportingTsExtensions` 正好允许。
2. **macOS 的 `sed -i` 要 `sed -i ''`**，否则报 `unescaped newline inside substitute pattern`，且会静默不改文件——批量改导入时踩了一次，改用 python 落盘。
3. **验收脚本 CDP evaluate 默认 12s 会在第 10 个场景偶发超时**（连续 12 次 reload + 广播轮询）。放宽到 20s 后 10/10 稳定；不是业务 bug，但没有证据前不能当成"环境抖动"打发。
4. **禁词扫描要扫到模板文案**：`tenureClue` 原来写"历史申请 N 次驳回"，"驳回"在判定前就泄露了结论倾向，改成"需补充材料"。
5. 预算一旦贴线，**每次改文案都要重新量**：`verify:budget` 已进 CI，构建后必跑。

### 13.6 线上验收（在真实地址上跑，不是本地）

提交 `e186807` 推送到 `main` → `deploy.yml`（含新的 `npm test` / `verify:budget` 门禁）重建 → 线上 HTML 已换成新产物 `assets/index-C53IDwrW.js`（轮询 2 次命中，约 40s）。

同一套脚本在 **`https://lusuallen.github.io/ai-please/`** 上重跑：

```text
PASS: 10/10 scenarios; 241 assertions; runtimeErrors=0   → /tmp/live-v3
```

线上证据图：`docs/shots/17-live-round6-inspect.png`（线上开档解封线索）、`docs/shots/18-live-round6-d03-320.png`（线上 D03 在 320×568 的排版）。

### 13.7 签字状态

**★1 首屏动词：已签（用户 m02093：「1 改成开始游戏」）。** 首屏主按钮改为中文动词 `开始游戏`，下挂英文小字 `START GAME`（有存档时 `START NEW SHIFT`）——中文承担"让人一眼知道点它会开始"，英文小字保留像素机台的双语质感，同时验收脚本按英文小字定位，断言不用改口径。

**★4 结算顺序：已签（用户 m02093：「4 复盘然后结局」）。** 保持现状：`SHIFT REPORT` 逐条复盘在前，`ENDING` 结局在后。

- 阶段 5「现场展示优化」：未开始。

---

## 14. 第七轮：减法（框架层换引擎 + 死代码清理）

### 14.1 需求

用户（m01668）：「请继续，同时做减法。不影响游戏核心玩法」。硬约束：生成结果、判定逻辑、界面表现、存档兼容一个都不能动。

### 14.2 做了什么

| 项 | 做法 | 收益 |
| --- | --- | --- |
| 框架运行时 | `vite.config.ts` 加 `resolve.alias`，把 `react` / `react-dom` / `react-dom/client` / `react/jsx-runtime` 指向 `preact/compat` | 首屏 JS 69.76 → **31.90kB gzip**（−37.86kB，−54%） |
| 死样式 | 删 `.visitor-meta` / `.visitor-service` / `.info-list` / `.rule-chip-row` / `.info-val .hl` | CSS 22.9 → 22.7kB |
| 校验器消息 | `validateRun` 的失败消息从自然语言压成 `码:原因:标识`（`I3:verdict:V-003`），禁词扫描改用预编译正则 | 逻辑更紧凑，报错仍可定位 |
| 重复文案 | `ModeChoice` 三处「不改分数只改结局」合并成一处 | 少两行重复 |

### 14.3 等价性证据（这是"减法"能否成立的全部依据）

```text
生成快照  72 组局（D01/D02/D03 × 24 seed），哈希 6ea6656d4ab9ad0e 与改造前完全一致
单测      47 / 47 pass（node --test，含 10000 局不变量与 oracle 复算）
压测      3000 局 0 失败，p50 0.16ms / p95 0.33ms / p99 0.63ms
端到端    10 / 10 场景，241 断言，runtimeErrors=0
像素      home / playing / feedback 结算前 / last-visitor / verdict / result 六态
          与 React 产物逐像素一致：0 / 1152000 像素差异（max delta 0）
预算      首屏 31.86kB / 70kB（45.5%）；全部 JS 34.74kB / 74kB；总产物 118.06kB / 260kB
```

### 14.4 换引擎时暴露的一个真 bug（不是框架的锅）

首版换 Preact 后验收挂了两条：`存档记录绑定当前访客` 读到上一位的 `V-005`、末位通关后不弹模式选择。根因是**进度落盘挂在 passive effect 上**：React 18 恰好在下次交互前刷完，Preact 走的是帧后调度，"判定 → 立刻刷新"就会读到上一帧的状态。改成 `useLayoutEffect`（本次提交内一定落盘），两个框架下都按同一语义执行——这属于把隐式时序依赖去掉，行为反而更确定。

### 14.5 取舍

- `react` / `react-dom` 仍留在 `dependencies`：只作为 `@types` 的解析来源和 dev 兜底，不进产物；删掉会让类型解析变脆，收益为零。
- 回退成本 = 删掉 `vite.config.ts` 里的 `preactAlias` 一段，其余代码零改动。
- 未做：路由级代码分割（只有 1 个路由，分割只会增加请求数）。

### 14.6 第三批：死导出清理（可证明无人引用）

用脚本把 `src/` 全部 `export` 名与实际引用做全量比对，只留下两处真无人调用的：

- `src/game/generator.ts` 的 `GenerateOptions`（早先设计过对象入参，最终用了位置入参 `generateRun(dayId, seed)`）；
- `src/components/PassportZoom.tsx` 的 `PASSPORT_STAMP_MS` 再导出与随之空转的 `STAMP_MS` 导入。

CSS 侧同样全量比对（`.class` 出现次数 vs `.tsx/.ts`），**0 个死类**——第一批删掉的 5 个死样式是当时唯一的残留。

### 14.7 线上验收

提交 `6527432`（框架减法）+ 本批死导出清理推送 `main` → `deploy.yml` 重建 → 线上 HTML 换成 `assets/index-2uFeCSUM.js`（轮询第 4 次命中，约 30s）。同一套脚本在线上重跑：

```text
PASS: 10/10 scenarios; 241 assertions; runtimeErrors=0   → /tmp/live-subtraction
```

提交 `5809594`（死导出清理，产物哈希不变——`PASSPORT_STAMP_MS` 本就被 Rollup 摇掉，说明树摇一直在生效）再次推送并复跑，仍是 10/10 · 241 断言。

线上证据：`docs/shots/19-live-round7-broadcast.png`（线上广播锁操作）、`docs/shots/20-round7-preload-home.png`（线上首屏）、`docs/shots/21-live-round7-d03-390.png`（线上 D03 在 390×844 的竖屏排版，横向溢出 0px）。

### 14.8 本轮净收益

| 指标 | 改造前 | 改造后 | 变化 |
| --- | --- | --- | --- |
| 首屏 JS（gzip） | 69.76kB | 31.86kB | −37.90kB（−54.3%） |
| 全部 JS（gzip） | 72.53kB | 34.74kB | −37.79kB |
| 总产物 | 186.09kB | 118.06kB | −68.03kB |
| 单测 / 端到端 | 47 / 10 场景 241 断言 | 同左 | 无回退 |
| 生成结果 | 72 组快照 | 哈希不变 | 逐字节一致 |

首屏预算占用从 99.7% 降到 45.5%——后续加内容不必再为 0.1kB 抠文案。

### 14.9 第八轮：★1 / ★4 签字落地

用户 m02093 给两项待签项拍了板：

| 待签项 | 决定 | 落地 |
| --- | --- | --- |
| ★1 首屏动词 | 「改成开始游戏」 | `HomeScreen.tsx` 主按钮：`开始游戏` + `<small>START GAME / START NEW SHIFT</small>`；中文用正文字体，英文小字沿用 7px 等宽像素风 |
| ★4 结算顺序 | 「复盘然后结局」 | 与现状一致，不改代码；本轮把签字状态写进 13.7，避免下一轮又被当成"待决" |

验收口径没有放宽：`verify-v3` 仍按英文小字 `START GAME` 定位按钮点真实点击（中文文案变了，机器锚点没变），10 场景 241 断言保持 `10/10`。

复核证据：

```text
生成快照  6ea6656d4ab9ad0e（未受影响：这是纯文案改动）
单测      47 / 47 pass
预算      首屏 31.92kB / 70kB；总产物 118.10kB / 260kB
端到端    10 / 10 场景，241 断言
视口      390×844 与 1280×900 下 overflowX = 0
```

证据图：`docs/shots/22-round8-home-start-cn-390.png`（本地构建 390×844 首屏）、`docs/shots/23-live-round8-home-start-cn-390.png`（线上首屏，按钮文案 `开始游戏 START GAME`）。

### 14.10 线上复验（本轮）

提交 `2899418` 推送 `main`（首次 push 遇到 `Recv failure: Operation timed out`，重试一次成功——网络问题，不是代码问题）→ `deploy.yml` 重建 → 线上 HTML 换成 `assets/index-CmbJwozc.js`（轮询第 4 次命中）。线上重跑：

```text
PASS: 10/10 scenarios; 241 assertions; runtimeErrors=0   → /tmp/live-round8
```

线上首屏按钮文案实测：`开始游戏 | START GAME`，`overflowX = 0`。

---

## 15. 第九轮：阶段5展示优化（2026-10-24）

> 输入：`docs/HANDOFF-NEXT-ROUND.md`（第九轮交接提示词 §4.1/§4.2/§4.4）。判定层与生成层未动，快照哈希 `6ea6656d4ab9ad0e` 不变；机制扩展 B/A/C 按规格本轮不启动。

### 15.1 改了什么

| 编号 | 需求 | 落地 |
| --- | --- | --- |
| S5-H1 | 首屏写死「七条规则」 | `src/screens/HomeScreen.tsx` 改用 `rulesForEvents(getBlueprint(day).events).length`；实测 D01=6 条、D03=7 条，`12 位访客，7 条规则` 与 `8 位访客，6 条规则` 都随关卡切换 |
| S5-H2 | 三 CTA 主次不分 | 主按钮「开始游戏」= `btn btn-wide btn-approve`，`RESUME` = `btn`，`VIEW HOW TO PLAY` = `btn-ghost`；英文小字 `START GAME / START NEW SHIFT` 保留为验收锚点 |
| S5-P1 | 进度条对读屏不可见 | `.stat-progress` 加 `role="progressbar"` + `aria-valuemin/max/now` + `aria-valuetext`（`已判 N 位 · 共 M 位`）；`.pip-track` 保持 `aria-hidden` |
| S5-P2 | 盖章等待固定 900ms | `handleStamp` 改为 `prefers-reduced-motion: reduce → 0ms`、默认 340ms，`STAMP_MS` 只作兜底；线上实测 92ms / 376ms |
| S5-R1 | 结算页藏姓名节点 | 删掉 `<span style={{display:'none'}}>{v?.name}</span>` 及无用 `visitors.find` |
| S5-A1 | viewport 禁止缩放 | 根 `index.html` 改为 `width=device-width, initial-scale=1.0, viewport-fit=cover`（规格写 `src/index.html` 属文档漂移，实际文件在仓库根） |
| S5-A5 | 缺 CSS 预算 | `scripts/check-budget.mjs` 新增 `INITIAL_CSS_GZIP_BUDGET = 6200`，输出四行预算：首屏 JS / 全部 JS / `[首屏CSS]` / 总产物 |
| S5-H3 | day chip 内联样式 + 锁定无语义 | 抽到 `.day-pick` / `.day-chip` / `.day-chip-locked`，`aria-label` 含「未解锁」，`aria-pressed` 保留 |
| S5-H4 | 矮屏首屏被裁 | `.home { justify-content: safe center }`，320×568 `.home-kicker` 顶端不再被裁 |
| S5-P3 | 信号卡只靠颜色 | 每张 `.signal` 增加 `.sig-level` 文本（`ALERT/WARN/INFO`），与 `SignalLevel` 枚举一一对应 |
| S5-P5 | 计分表每位都弹 | `FeedbackOverlay` 新增 `index` 入参，`index < 2` 才渲染 SCORING TABLE |
| S5-P6 | `.stamp-sub` 9px 低对比 | 改为 11px + `var(--ink-dim)`（实测 `rgb(134,152,179)`） |
| S5-P7 | toast 按钮过小 | `.toast .t-action` 置 `min-height: 40px`（实测 40px） |
| S5-P8 | 320px 直接隐藏 tier | `max-width:48%` + 省略号截断，不再 `display:none`（320 下实测 `FLAGGED` 可见） |
| S5-R2 | 误判流水行无标记 | `.log-row.bad` 3px 左边框 + 内缩；`#ff5470` on `#0a1120` ≈ 6.1:1 |
| S5-R3 | MISJUDGED 单格混排 | 拆成「误放行 · WRONG APPROVE」与「误拒绝 · WRONG DENY」两格 |
| S5-A2 | 判定结果无播报 | 新增 `.sr-only` 类 + `role="status" aria-live="polite"` 播报「第 N 位：判定 X，正确/错误」 |
| S5-A3 | 动画无预算 | 新增 `tests/display-budget.test.ts`：动画名/时长白名单（fade-in 120 / slide-up 160 / slide-down 180 / stamp-in 320·380 / pip-pulse 1.1s / blink 1.2s）、无限循环 ≤2、非白名单 ≤400ms、transition ≤60ms |

**未做（已披露）**：S5-A4 设计 token 收敛（12→6 等）风险最高、与本轮展示改动无耦合，规格允许延后，下一轮单独做；仍待用户签字的 ★3、★5、S5-R4、S5-P4 与机制扩展 B/A/C 取舍不在本轮范围。

e2e 新增 8 个场景（原 10 场景 241 断言 → 18 场景 325 断言，只增不减）：`home-copy-matches-rule-count`、`progressbar-exposes-position`、`stamp-wait-bounded`、`scoring-table-first-two-only`、`touch-target-min-40`、`zoom-enabled`、`display-change-no-answer-leak`、`round9-visual-and-live-region-contracts`（覆盖 signal 等级文字 / 320 下 `.pp-tier` / `.stamp-sub` 计算样式 / aria-live 播报）。

顺带修掉两个验收脚本自身的坑，都是"假失败"而不是产品 bug：① 无头窗口键盘事件需要 `Emulation.setFocusEmulationEnabled`，否则 Escape/Tab 会被随机丢弃；② `click()` 补 `mouseMoved` 并等新访客渲染稳定再取样，否则布局位移会让点击落空（首轮 `stamp-wait-bounded` 就是这么红的）。

### 15.2 线上验收（真实地址）

**地址：https://lusuallen.github.io/ai-please/**

| 项 | 实测 |
| --- | --- |
| 提交 | `4d1dba2`（代码）+ `e62d3e1`（门禁脚本）+ `c96553f`（展示预算测试） |
| 发版 | push `main` → Actions 重建；轮询线上 `index.html` **第 4 次**命中新产物 `assets/index-CieLlWy_.js`（前 3 次仍是 `index-CmbJwozc.js`） |
| 线上 e2e | `18/18 场景 · 325 断言 · runtimeErrors=0`（`/tmp/live-r9`） |
| 线上首屏文案 | `12 位访客，7 条规则`（D03）/ `8 位访客，6 条规则`（D01）实测通过 |
| 线上进度条 | `role=progressbar`、`aria-valuemax=8`、`aria-valuetext="已判 1 位 · 共 8 位"` |
| 线上盖章等待 | reduced-motion 92ms、默认 376ms |
| 线上触控目标 | `.day-pick button` 41px、`.pp-open` 44px、`.pp-portrait` 74px、`.toast .t-action` 40px |
| 本地门禁 | 生成快照 72 组 `6ea6656d4ab9ad0e`；单测 50；预算首屏 JS 32.13kB/70、首屏 CSS 5.54kB/6.2、全部 JS 35.01kB/74、总产物 119.58kB/260；`stress` 10000 局 0 失败 |

证据图：`docs/shots/24-round9-home-rule-count-1280.png`、`25-round9-progressbar-1280.png`、`26-round9-touch-targets-1280.png`、`27-round9-contracts-320.png`（本地构建）、`28-live-round9-home-rule-count-1280.png`、`29-live-round9-contracts-320.png`（线上真地址）。

### 15.3 签字状态

| 项 | 状态 |
| --- | --- |
| 本轮 P0×7 | 7/7 落地并通过本地 + 线上验收 |
| 本轮 P1 | 除 S5-A4（设计 token 收敛，按规格延后并在此披露）外全部落地；S5-P4 属用户签字项，未做 |
| 仍待用户签字 | ★3、★5、S5-R4、S5-P4；机制扩展 B/A/C 的取舍（本轮不启动） |
| 验收口径 | 只增不减：旧 10 场景 241 断言全部保留并通过，新增 8 场景 84 断言 |

---

## 16. 第十轮：D04 上线（关卡配方化第一步，2026-10-24）

拍板依据：CPO / CTO / 验收三线会诊后用户在 m00465 一次性批准六个拍板点（保留 D01–D03 为固定教学关、只给新关做规则参数化、先补 D04、判定与评分机制不变、主线 8 关封顶 + 加班模式、单局时长上限）。本轮只落**第 3 点（补 D04）**，其余按顺序后续轮次推进。

### 16.1 改了什么

| 面 | 内容 |
| --- | --- |
| 新增 `src/data/specs.ts` | `LevelSpec` → `composeBlueprint` → 现有 `DayBlueprint`；`lintBlueprint` 做 I15–I17 配方侧校验（配额和 = 人数、人数 6–24、槽位范围/重复/卡 id、事件 kind/范围/严格递增/特赦窗口/名单变更形状）。加关从此是「加一条 spec + 过 linter」，不再手改六处 |
| `src/data/levels.ts` | `LEGACY_DAY_IDS = ['D01','D02','D03']` 冻结；配方循环并入 `BLUEPRINTS`（重名抛错）；`DAY_IDS = [...LEGACY_DAY_IDS, ...LEVEL_SPECS.map(id)]` |
| D04 配方 | 16 位访客、配额 N4/D3/A6/I1/S1/C1（放行率必在 0.45–0.68）、事件 R06@3 → 名单变更@6（开 SG-03 / 关 TZ-07）→ 特赦 8–10 → R07@11、S 池 4 候选 + C 池 4 候选、`allowCleanConfirm: true` |
| `src/styles/global.css` | `.day-pick` 由固定 3 列改 `repeat(auto-fit, minmax(64px, 1fr))`：4 关自适应，320 宽仍 ≥40px 触控目标 |
| `scripts/snapshot-runs.mts` | 快照按天拆分：`legacy-combined`（D01–D03，72 组，**必须恒等** `6ea6656d4ab9ad0e`）+ `composed-combined`（D04 起）+ `combined`（仅变更提示，不作判据）。加新关不再产生「假红」 |
| `scripts/verify-v3.mjs` | 新增场景 `day4-ladder-extends`：首页 4 个关卡按钮且分别是 D01–D04、切 D01 仍 8 位/6 条、切 D04 首屏 16 位/7 条、`aria-valuemax=16`、16 个 pip、`aria-valuetext` 含「共 16 位」、局内 RULES OF THE DAY、判定第一位后 `aria-valuenow=1`。既有场景「首页展示三天」同步为「四天」并补「未解锁的三天不可点」——关卡数由 3 → 4 是产品事实变化，断言只增不减 |
| 新增 `tests/levels.test.ts` | 6 个测试：配方 linter 全过且进 `DAY_IDS`；`DAY_IDS` 顺序 = 冻结区在前；D01–D03 人数/规则数仍 8/10/12 与 6/6/7；每条配方 24 种子零失败零校验错误；新关判定唯一 + 需开档者有 warn/alert + 放行率 0.45–0.68；D04 名单变更早于特赦窗口 |

本地门禁（提交前）：

| 门禁 | 结果 |
| --- | --- |
| `npm test` | **56 通过 / 0 失败**（原 50 + 关卡配方 6） |
| `npm run build` | `assets/index-CNjGfvce.js` 85.73kB raw / 32.45kB gzip；`assets/index-fXceeYVY.css` 23.62kB / 5.58kB gzip |
| `npm run verify:budget` | 首屏 JS 32.41/70、全部 JS 35.29/74、首屏 CSS 5.56/6.2、总产物 120.63/260（四行全过） |
| 快照 | `snapshots=96`；`legacy-combined=6ea6656d4ab9ad0e`（冻结区一字未动）；`composed-combined=67ddbed53bb99ede` |
| 本地 e2e | `PASS: 19/19 scenarios; 339 assertions`（`/tmp/e2e-r10-final2`，断言只增不减，`runtimeErrors=0`） |
| `npm run stress` | `runs=10000 failures=0`，`perDay=D01:2500 D02:2500 D03:2500 D04:2500`（D04 自动进入不变量矩阵） |

### 16.2 线上验收

| 项 | 结果 |
| --- | --- |
| 提交 | `c94e95f`（代码）+ `6f742ec`（门禁脚本）+ `2e2c078`（关卡配方测试） |
| 发版 | push `main` → Actions `2e2c078` **completed success**；轮询线上 `index.html` **第 4 次**命中新产物 `assets/index-CNjGfvce.js`（前 3 次仍是 `index-CieLlWy_.js`）。push 首次因 `Error in the HTTP2 framing layer` 失败，用 `-c http.version=HTTP/1.1` 重推成功（非代码问题） |
| 线上 e2e | `19/19 场景 · 339 断言 · runtimeErrors=[]`（`/tmp/live-r10`，Chrome/155.0.8059.85） |
| 线上 D04 首屏 | 「16 位访客，7 条规则」，四个关卡按钮 `D01 8 位访客 / D02 10 位访客 / D03 12 位访客 / D04 16 位访客` |
| 线上 D04 局内 | `aria-valuemax=16`、`aria-valuetext="已判 0 位 · 共 16 位"`、16 个 `.pip-track .pip`、判定第一位后 `aria-valuenow=1` |
| 线上旧关回归 | D01 仍 8 位/6 条、D03 仍 12 位/7 条；第九轮 8 个可达性场景全部继续通过 |

证据图：`docs/shots/30-live-round10-home-four-days-1280.png`（首页四关）、`31-live-round10-day4-home-1280.png`（D04 首屏 16 位/7 条）、`32-live-round10-day4-in-run-1280.png`（D04 局内 16 个 pip，线上真地址）。

### 16.3 签字状态

| 项 | 状态 |
| --- | --- |
| 本轮范围（拍板点 3：补 D04） | 已落地并通过本地 + 线上验收 |
| 冻结区 D01–D03 | 蓝图、判定、生成器一行未改；72 组快照哈希恒等 `6ea6656d4ab9ad0e` |
| 判定/评分/开档机制（拍板点 4） | 未改动：`rules-eval` / `engine` / `zones` / `rng` / `validate` / `generator` 全部原样 |
| 按拍板顺序仍待做 | ① 规则参数化（只挂新关）② 开档额度接入（`inspectQuota` 目前零调用点）③ R08/R09 与 D05–D08 配方 ④ 加班模式与跨关资产（职级/人事档案）⑤ 反背题三支柱（开档额度、每日规则参数化、双证据冲突） |
| 已知缺口（本轮主动披露） | `validate.ts` 的 I8 只看**第一个** `zoneChange`，D04 因此只用单次名单变更；后续若上双 zoneChange 必须先补 I8，否则校验会漏 |
| 未做的旧项 | S5-A4 设计 token 收敛（第九轮披露延后）、S5-P4 / ★3 / ★5 / S5-R4（用户签字项）、机制扩展 B/A/C 取舍 |

## 17. 第十一轮：双语注释层（2026-10-24）

拍板依据：用户反馈「英语部分过多」，要求**保留英语（专业名词）的同时给出中文注释或部分直接汉化**，照顾英文/术语薄弱的玩家（m00002）。CPO 定调：问题不是「英语太多」，而是**决策必需标签全英文、说明长文全中文，两者之间没有桥**；UI 设计师实测 320×568 主屏纵向余量为负（320 可用 347.5px / 内容 543px，375 溢出 96px），因此**主屏高度增量必须为 0**；前端开发者确认零 i18n 基建，且数据层被三道门禁锁死（快照哈希 `6ea6656d4ab9ad0e`、I6 禁词、20KB 存档上限）。

### 17.1 改了什么（纯视图层，`src/data` 与 `src/game` 一行未动）

| 面 | 内容 |
| --- | --- |
| 新增 `src/i18n/terms.ts` | 纯数据术语表：`RULE_ZH`（R01–R07）、`TIER_ZH`（normal/anomaly/inspect/special/conflict）、`MOVE_ZH`（APPROVE/DENY/INSPECT）。无 JSX，可被 `node --test` 直接导入 |
| 新增 `src/i18n/ZhInline.tsx` | `Zh` 副注节点：输出 `<span class="bi-zh">中文</span>`，CSS 用 `::before: ' · '` 拼出「英文 · 中文」 |
| 新增 `src/i18n/zh.tsx` | 对外入口，`export { RULE_ZH, TIER_ZH, MOVE_ZH }` + `Zh`（组件统一从这里取，测试只导入 `terms.ts`） |
| 新增 `tests/i18n-terms.test.ts` | 4 个守护测试：每条 `RULE_BASE` 都有非空且不含拉丁字母的中文副注；术语表不出现不存在的规则码；动作/风险等级全覆盖；`rulesForEvents` 裁剪后仍全覆盖。**以后加规则不配中文会直接红** |
| 新增 `scripts/probe-zh.mjs` | 320×568 与 390×844 双档真实点击探针：首页→局内→规则抽屉→护照放大→反馈层→整班结算，逐步 `measure()`（`.bi-zh`/.bi-line/.bi-en 的折行数、左右溢出、页面横向滚动）+ 截图。退出码 0 = 无折行/无溢出 |
| `StatusBar` | `VISITOR · 访客`、`FUNDS · 预算`、`SCORE · 分数`；进度条 `aria-valuetext` 保持原文 |
| `ActionBar` | 主按钮改「中文 + 英文双行」：`开档 INSPECT`、`拒绝 DENY`、`放行 APPROVE`；英文子标签 `GRANT ACCESS` / `REFUSE ENTRY` / `-¥25` 保留 |
| `PassportDoc` | 四字段加 `Zh`：`IP REGION · 地区` / `TIMEZONE · 时区` / `ACCOUNT REGION · 账号` / `LANGUAGE · 语言`；`DECLARED REASON · 申报理由`；风险等级标签 `STANDARD · 常规` 等；页脚提示 `SURFACE LAYER · 点护照放大`、`DEEP FILE UNSEALED · 深档已开封`。MRZ、`APPROVE/DENY` 印章位、数字列保持原样 |
| `PassportZoom` | 行值后加地名/语言/服务中文：`OR-09 · 东岸开发区`、`UTC+01:00`、`CLAUDE-ORBIT · 长文本分析`、`WITHHELD · 需开档查看`、`DAY 001 → DAY 080` 原样 |
| `RuleDrawer` | 规则名双语 `R01 OPEN ZONE · 开放区`…`R07 EMERGENCY ORDER · 紧急豁免令`；抽屉头 `D01 · RULES OF THE DAY · 今日规则` |
| `FeedbackOverlay` | 新增决策对照行「你的判定：放行 · 应为：放行」（此前只有 `YOU: APPROVED · REQUIRED: APPROVE`）；`SCORING TABLE · 计分表`、`JUDGEMENT BASIS · 判定依据` |
| `HomeScreen` / `ResultScreen` / `ModeChoice` / `UpdateToast` | 首页 `AI SERVICE BORDER INSPECTOR · AI 边境审核员`、`开始游戏 START GAME`、`玩法说明 VIEW HOW TO PLAY`；结算 `SHIFT REPORT · 班次报告`、`FINAL VERDICT · 最终裁定`、`AUDIT LOG · 审核流水`、六个指标格 `CORRECT · 判定正确` 等；广播卡标题双语 |
| `src/styles/global.css` | 只加 5 条：`.bi-zh`（9px / `letter-spacing:0` / `--ink-dim` / `white-space:nowrap` + `::before` 分隔符）、`.bi-zh.lg`（10px）、`.bi-line`/`.bi-en`（动作栏双行）、`.pp-row .pp-v .bi-zh{display:inline-block}`（窄屏整体换行，不出现「长文本分/析」断字）`.pp-footline{overflow:hidden;white-space:nowrap;text-overflow:ellipsis}`（页脚提示永不多折一行——320 主屏多 1 行就会把整页顶出滚动条）+ 既有 `.pp-head-tags{flex:0 0 auto}`、`.pp-panel .panel-title` 省略号、`@media (max-width:360px){.pp-tier .bi-zh{display:none}}`（`pp-tier` 在该断点被设计限制 48% 宽 / 7px 字号，7px 汉字不可读） |

**禁译清单（刻意保持纯英文）**：`.sig-level`（`scripts/verify-v3.mjs:563` 断言 `innerText === 'ALERT'/'WARN'/'INFO'`）、MRZ 机读码、流水号/货币数字列、`.pp-slot` 印章位、`.tag` 内 7–9px 容器、`AI, PLEASE` 品牌字。

### 17.2 门禁（提交前本地）

| 门禁 | 结果 |
| --- | --- |
| `npm run build` | `tsc --noEmit` 0 error；产物 `index-BIJNhz_d.js` + `index-DIR6dbgr.css` |
| `npm test` | **60 通过 / 0 失败**（原 56 + 双语守护 4） |
| `npm run verify:budget` | 首屏 JS 33.07 / 70kB（47.2%）、**首屏 CSS 5.73 / 6.2kB（92.4%）**、总产物 124.09 / 260kB（47.7%），四行全过（CSS 余量仅约 480B，后续加样式要先跑这条） |
| `npm run verify:acceptance` | `PASS: 19/19 scenarios; 339 assertions`，`runtimeErrors=0`（断言只增不减） |
| `node --experimental-strip-types scripts/probe-zh.mjs` | `bad=[]`、`sceneError=null`，两档 10 个状态 + 整班结算全部 `.bi-zh` 单行、无左右溢出、`documentElement.scrollWidth - clientWidth = 0` |
| 数据层隔离 | `src/data` / `src/game` / `src/types` 与 `scripts/verify-v3.mjs` 零改动；快照哈希仍 `6ea6656d4ab9ad0e` |

### 17.3 已知取舍（如实披露）

| 项 | 现状 | 原因 |
| --- | --- | --- |
| `.pp-tier` 风险标签 | ≤360px 只显示英文（`STANDARD`/`FLAGGED`/`DEEP CHECK`），390px 起才出现 `· 常规` 等中文 | 该断点样式表把 `pp-tier` 限制在 48% 宽 / 7px 字号，7px 汉字不可读且会截断；风险状态在 390px+、颜色边框与「异常扫描」面板里仍可达 |
| 320px 且访客理由较长 | `ACCOUNT REGION · 账号` 偶发折成两行（`ACCOUNT` / `REGION · 账号`） | 理由过长会让护照区出现内部滚动条，占掉约 15px 宽度，标签列被挤窄。行高 +11px 发生在护照内部滚动区，判定栏仍在首屏内、无裁切、无横向滚动；真实手机为浮层滚动条一般不触发。探针断言的是 `.bi-zh` 自身不折行、不溢出，父级标签折行属于既有排版余量问题 |
| 结算页六格指标 | 320px 下 `k` 标签（如 `误放行 · WRONG APPROVE`）折两行 | 设计基线 `result-grid .k` 在纯英文时（130.8px / 127px）就已折行，加中文不改变结构，只是折得更早 |
| `ModeChoice` 卡名 | 仍为 `STRICT MODE` / `HUMAN MODE`，中文在下方 `mc-desc` | `mc-desc` 实测 231/238px 已无余量，卡名加中文会把两列卡片顶破 |
| 术语表位置 | 只在视图层 `src/i18n`，不进数据层 | 数据层被快照哈希 / I6 禁词 / 20KB 存档三道门禁锁死，`{en,zh}` 结构会同时打破三道 |

### 17.4 复现与扩展

```bash
npm run build && npm test && npm run verify:budget
node scripts/serve-dist.mjs 4175 &        # 探针依赖已构建的 dist
npm run verify:acceptance
npm run verify:zh            # = scripts/probe-zh.mjs，同样依赖 4175 上的 dist
```

新增规则/等级/动作时：先改 `src/i18n/terms.ts`，`npm test` 会在 1 秒内告诉你漏了哪条；新增英文标签时套 `.bi-zh`（小字容器）或 `.bi-line`（动作栏双行），并跑一次 `probe-zh.mjs` 确认 320 不折行、不横向滚动。

证据图：`docs/shots/33-round11-bilingual-game-320.png`（局内四字段 + 三键）、`34-round11-bilingual-drawer-320.png`（规则抽屉 R01–R07）、`35-round11-bilingual-zoom-320.png`（护照放大页）、`36-round11-bilingual-feedback-320.png`（反馈层「你的判定/应为」）、`37-round11-bilingual-result-320.png`（结算页）、`38-round11-bilingual-game-390.png`（390 主视口基线）。

## 18. 第十二轮：操作词汉化 + 判定反馈讲清楚（2026-10-24）

用户第二条反馈原话：`诸如 Correct，Close，Password 这种可以汉化的也可以一并汉化方便用户知道是什么操作。评判后的结果反馈最好也需要汉化，提示什么结果，什么加了什么减了，对了还是错了`。

### 18.1 文案三层契约（本轮确立，后续一律照此改）

| 层 | 判据 | 例子 | 允许的写法 |
| --- | --- | --- | --- |
| L1 机器锚点 | `scripts/verify-v3.mjs` 用 `clickText` / `includes` / 负断言匹配的字面量 | `NEXT VISITOR`、`RESUME`、`START GAME`、`ACKNOWLEDGE`、`SCORING TABLE`、`RULES OF THE DAY`、`BACK TO MENU` | 英文必须是**可见 `innerText`**；不许 `display:none` / `sr-only` / 条件渲染（`START GAME` 原先只在无存档时出现，本轮改为常驻） |
| L2 领域标签 | 决策要用、但英文可读性差的字段名 | `ACCOUNT REGION · 账号`、`IP REGION · 地区`、`R01 OPEN ZONE · 开放区` | 英文主标 + `.bi-zh` / `.bi-line` 中文副注；英文一个字母都不能少 |
| L3 操作与状态 | 用户要"知道这是什么操作"的词 | `判定正确`、`关闭`、`展开`、`未解锁`、`未盖章`、`班次报告`、`条文模式` | 中文为主（`.cn`，必须 `letter-spacing:0`），英文降为 7px 副标或省略 |

### 18.2 判定反馈层重写（`src/components/FeedbackOverlay.tsx`）

信息顺序按「先结论、后证据、最后教学」重排：

1. 结论：`判定正确` / `判定错误`（7px 副标 `VERDICT ACCEPTED` / `VERDICT REJECTED BY AUDIT`）；
2. 判错归因：`误放行 · 应判拒绝` / `误拒绝 · 应判放行`（印章仍是 `正确 CORRECT` / `错误 WRONG`）；
3. 契约对照行：`你的判定：放行 · 应为：拒绝`（保留 `YOU: … REQUIRED: {v.correct}` 英文锚点）；
4. 本次变动：三枚 chip `分数 +100` / `预算 +120` / `开档 −25`，带 `data-kind` 与 `data-delta`，值为**存档里的真实增量**；
5. 本单净额：`本单净额 分数 −150 · 预算 −200`（开档 −¥25 不在判定链路里，单独成行，避免"判定扣了 200 又赚 25"的错觉）；
6. 账户前后：`账户 200 → 50 分 · ¥1240 → ¥1040`，开档时追加「开档只扣预算，不扣分数」；
7. 依据：`判定依据` + 规则码 chip；8. 教学：`计分表 SCORING TABLE`，正文改中文「答对 +100 · 误放行 −150 · 误拒绝 −100」。

`Password` 全仓库 0 命中（本项目没有输入框/凭证交互），未新造概念。

### 18.3 逐文件改动

| 文件 | 改动 |
| --- | --- |
| `src/i18n/terms.ts` | 新增 `VERDICT_ZH` / `STAMP_ZH` / `WRONG_KIND_ZH` / `METRIC_ZH` / `UI_ZH` 五张纯中文表 |
| `src/components/FeedbackOverlay.tsx` | 按 18.2 重写；新增 `score` / `funds` props（只读，不改数据层） |
| `src/screens/GameScreen.tsx` | `ANOMALY SCAN`→`异常扫描`、`INSPECT TO UNSEAL · ¥25`→`开档解锁 · ¥25`；向反馈层传当前 `score`/`funds` |
| `src/components/StatusBar.tsx` | `VISITOR/FUNDS/SCORE` → `访客/预算/分数` |
| `src/components/HomeScreen.tsx` | `LOCKED`→`未解锁`；`<small>` 修正为有存档时 `NEW SHIFT · START GAME`、无存档时 `START GAME` |
| `src/components/ModeChoice.tsx` | `条文模式 / 人情模式`（`.bi-en` 保留 `STRICT MODE` / `HUMAN MODE`） |
| `src/components/RuleDrawer.tsx` | `关闭 ✕`、`展开 ▸`、表头 `代码/地区/时区/语言/状态` |
| `src/components/PassportDoc.tsx` | `NOT STAMPED`→`未盖章`；`PASSPORT ▸`→`护照 PASSPORT ▸` |
| `src/components/PassportZoom.tsx` | `CLOSE`→`关闭`、`STAMP APPLIED`→`已盖章 · 归档中…`、`WITHHELD · 需 INSPECT`→`需开档查看` |
| `src/screens/ResultScreen.tsx` | `班次报告 SHIFT REPORT`、六格改「判定正确/判定错误/开档次数/误放行/误拒绝/总分/预算结余」、新增开档支出行、`最终裁定 FINAL VERDICT`、`归档`、`审核流水 AUDIT LOG` |
| `src/styles/global.css` | 新增 `.cn{letter-spacing:0}`、`.cn + .bi-en{margin-left:6px}`、`.stamp{white-space:nowrap;max-width:100%}`、`.stamp .cn{text-shadow:0 0 8px}`、`.delta.flat`、`.stat-label/.result-cell .k/.mc-title/.pp-slot-state/.locked{letter-spacing:0}` |
| `scripts/verify-v3.mjs` | 新增场景 `bilingual-controls-keep-both-layers`（四控件中英并存、状态栏汉化、抽屉表头、有存档时 `START GAME`/`RESUME` 常驻、`第 03 / 8 位` 数字相邻）+ 6 处断言双语化（判定前无结算层、结算中文可见、`SCORING TABLE` 反向、`SEALED` 反向、`display-change` 无泄漏、反馈层中文结论/印章/错型/账目对账） |
| `scripts/probe-zh.mjs` | 选择器扩到 `.bi-zh,.bi-line,.bi-en,.cn,.delta,.stamp,.result-cell .k,.stat-label`；行数改用「扣掉 padding/border 的内容高 ÷ line-height」；新增覆盖下限 `MIN_SPANS=90`（测量集合为空不再静默 exit 0）与判错反馈截图 |
| `tests/i18n-terms.test.ts` | +1 条：反馈层五张表必须纯中文、错型必须说清方向（`npm test` 60 → **61**） |

### 18.4 门禁（提交前本地）

| 门禁 | 结果 |
| --- | --- |
| `npm run build` | `tsc --noEmit` 0 error；产物 `index-CKvgGFRk.js` + `index-CTIu0TO9.css` |
| `npm test` | **61 通过 / 0 失败** |
| `npm run verify:budget` | 首屏 JS 33.50 / 70kB（47.9%）、**首屏 CSS 5.79 / 6.2kB（93.4%）**、总产物 126.19 / 260kB（48.5%） |
| `npm run verify:acceptance` | `PASS: 20/20 scenarios; 424 assertions`（上一轮 19/339） |
| `npm run verify:zh` | `bad=[]`、`spans=267`、`wrongVerdictSeen=true`、`docOverflow=0`、`docOverflowY=0`（320/390 两档 10 个状态 + 判错反馈） |
| 数据层隔离 | `src/data` / `src/game` / `src/types` 零改动；快照哈希仍 `6ea6656d4ab9ad0e` |

### 18.5 已知取舍

| 项 | 现状 | 原因 |
| --- | --- | --- |
| 反馈层在小屏可滚动 | 320×568 下 sheet 正文需滚动才能看全「计分表」 | 信息量按用户要求增加了（结论/归因/净额/账户前后），`max-height` 未突破 500px，页面本身不滚动 |
| `YOU: APPROVED · REQUIRED: APPROVE` | 英文行在 320 仍折两行 | 这是 L1 机器锚点（`:281` 断言 `REQUIRED: {v.correct}`），只能保留；中文对照行紧随之，理解不受影响 |
| `.pp-tier` 风险标签 | ≤360px 仍只显示英文 | 该断点被设计限制 48% 宽 / 7px 字号，中文不可读；同信息在「异常扫描」面板与颜色边框可达 |
| 320px 长理由 | `ACCOUNT REGION · 账号` 偶发折两行 | 护照内部滚动条吃宽度，属既有排版余量问题，非本轮引入 |

### 18.6 复现

```bash
npm run build && npm test && npm run verify:budget
node scripts/serve-dist.mjs 4175 &
npm run verify:acceptance && npm run verify:zh
```

证据图：`docs/shots/39-round12-home-320.png`、`40-round12-game-320.png`（护照入口 `护照 PASSPORT ▸`）、`41-round12-drawer-320.png`、`42-round12-verdict-correct-320.png`、`43-round12-verdict-wrong-320.png`（误放行归因 + 账户前后值）、`44-round12-result-320.png`、`45-round12-game-390.png`。

## 19. 第十三轮：feat 分支开发流程（2026-10-25）

### 19.1 改了什么

| 文件 | 内容 |
| --- | --- |
| `docs/GIT_WORKFLOW.md` | 新增流程文档：分支模型（trunk-based，不设 develop）、命名（`feat/` `fix/` `chore/` `docs/`）、Conventional Commits、合并门禁、PR 三段描述、Squash/`--no-ff` 选型、分支保护清单、回滚与热修、本机受限网络兜底 |
| `scripts/verify-all.mjs` | 新增「一条命令跑完合并门禁」：build → 单测 → 预算 → 起 `dist` 静态服务 → 验收 20 场景 → 双语探针，按快慢排序先便宜地失败；退出码 0/1/2 区分通过/门禁红/编排错误 |
| `package.json` | 新增 `npm run verify:all` |
| `.github/workflows/ci.yml` | PR 到 `main` 时跑 `verify:all`（ubuntu + runner 自带 Chrome），失败上传 `/tmp` 证据；`deploy.yml` 仍只管 `main` push，避免同一 push 跑两遍 |
| `scripts/probe-zh.mjs` | Chrome 路径跨平台：macOS 取默认安装路径，其他平台取 `CHROME_PATH` 或 `google-chrome`（CI 需要） |
| `README.md` | 「门禁与验收」以 `verify:all` 为唯一合并门禁；「部署」改为「分支与部署」；版本控制段改为从 `main` 开 `feat/*` 走 PR |

### 19.2 默认合并策略

- 分支内一条有效提交（或过程提交无保留价值）→ **Squash and merge**，main 保持一条整洁提交；
- 分支内多步可读历史（重构 / 行为 / 文档分开）→ **Merge commit（`--no-ff`）**；
- 不用 Rebase and merge（等于换一个新对象上生产，CI 验过的不是它）。

### 19.3 已知取舍

| 项 | 现状 | 原因 |
| --- | --- | --- |
| 不设 `develop` 分支 | 只有 `main` + 短分支 | 单人/小团队下长期分支只带来漂移与合并成本；发布由 `deploy.yml` 在 main 上完成 |
| PR 审批数 | 0（自审留痕） | 单仓库单人维护；门禁由 CI 承担，人工审批不产生额外信息 |
| 本机推送 | `github.com:443` 不可达；改走 `ssh.github.com:443` + 仓库 deploy key + `~/.ssh/config` 别名 `github-ai-please` | 标准 `git fetch/push` 可用；Git Data API 仅作网络再变时的兜底 |

### 19.4 复现

```bash
npm run verify:all     # 本地合并门禁（实测约 24 秒：build 1.9 / 单元 1.0 / 预算 0.3 / 验收 13.6 / 双语探针 7.6）
```

## 20. 第十四轮：玩法说明与规则抽屉汉化（2026-10-25）

### 20.1 改了什么

| 文件 | 内容 |
| --- | --- |
| `src/components/TutorialSheet.tsx` | 头部改为「玩法说明 HOW TO PLAY」；三步正文改成「中文按钮名 + 英文括注」：`今日规则`（RULES OF THE DAY）、`开档` INSPECT、`放行` APPROVE、`拒绝` DENY；底部按钮补英文副标：跳过说明 SKIP / 上一步 BACK / 下一步 NEXT ▸（`返回首页 / 返回审核` 保持原样） |
| `src/components/RuleDrawer.tsx` | 开放区注册表状态列 `OPEN/CLOSED` → `开放/关闭`（表头早已是中文，脚注保留 `OPEN 开放、CLOSED 关闭` 对照） |
| `src/styles/global.css` | `.sheet-foot` 改 flex 布局：次要按钮并排一行、主按钮独占整行（此前三个按钮逐个占一行，320 上白吃两行高度） |
| `scripts/probe-zh.mjs` | 新增玩法说明第 1/3 步与注册表下半屏的截图与度量；输出目录每次先清空（此前多轮运行会残留旧图，证据目录不可信）；场景覆盖 8 → 11 个 |

### 20.2 门禁

- `npm run verify:all` 全绿；`npm test` 61/61；首屏 CSS 5.80/6.2kB（93.6%）、首屏 JS 33.57/70kB、总产物 126.59/260kB
- 验收 20 场景 / **424 断言**（新增 5 条锁住本轮的汉化：教程标题中英并存、步骤名与正文中文、跳过/下一步按钮中英并存）
- `verify:zh`：`bad=[]`、`spans=347`（含教程/注册表新增元素）、320 与 390 均 `docOverflow=0 / docOverflowY=0`

### 20.3 已知取舍

| 项 | 现状 | 原因 |
| --- | --- | --- |
| 教程底部按钮英文副标 | 仅 `SKIP / BACK / NEXT`，`返回首页 ▸` 无英文 | `.sheet-foot` 一行放不下第三条副标；`返回` 语义已由中文与箭头表达 |
| 注册表状态列 | 只显示 `开放 / 关闭` | 列宽 60px，再加英文会换行；脚注保留英中对照 |
| 手册页 `HOW TO PLAY` | 只作头部副标，不再写「· 三步上手」 | 步数已由右上角 `01 / 03` 表达，避免重复 |
