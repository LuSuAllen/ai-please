# PROJECT STATUS — AI, PLEASE / AI SERVICE BORDER INSPECTOR

> 本文件是唯一事实来源。凡是没在这里贴出验证证据的东西，一律视为"未测试"。
> 最后更新：2026-10-24（第三轮：护照 GUI 落地 + 43 项断言复验）

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
| 阶段 5 | 现场展示优化 | ⬜ 待开始 |

**当前阻塞：无。护照场景已按用户需求实现（§10）；等用户对 §6 中 ★1–★5 的结构性调整签字（涉及层级重排与玩法取舍），再动阶段 2 后半段。**

---

## 2. 本地运行

```bash
cd /Users/lusuallen/Downloads/ai-please
npm run dev        # → http://127.0.0.1:5173/
npm run build      # tsc --noEmit && vite build
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
| ★2 | 点 START 立刻撞上 6 步文字墙 | 压到 3 步（你是谁 / 核哪四项 / 怎么判），规则会变、立场、计分表下沉到对应时刻再教 | 仅 `TutorialSheet.tsx` |
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

13 桌面端内容区滚动无提示（仅演示用）· 14 密封态 DEEP FILE 只为一行提示（现已随剩余高度自适应，`max-height:168px`）· 15 新手说明缺 SKIP · 16 ✅ `STAMP_MS` 已复活（`engine.ts:18` → 盖章到反馈的 900ms 间隔，实测 920–942ms）。

---

## 7. 已知限制

| 限制 | 影响 | 处置 |
| --- | --- | --- |
| 本机 git 不可用（`/usr/local/bin/git` 报 Bad CPU type；`/usr/bin/git` 未同意 Xcode license） | 无法版本控制 | 不影响开发运行；需要时修复 Xcode license |
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
| 自动发版 | `.github/workflows/deploy.yml`：push `main` → `npm ci` → `npm run build` → `upload-pages-artifact` → `deploy-pages` |
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
