# 并排控件行高审计（S6 · 护照头 chip 等高 + 全站同类扫描）

取样：Chrome CDP（本机 Chrome/155.0.8059.85，`Emulation.setDeviceMetricsOverride` + DPR 2 + iPhone UA，`Network.setCacheDisabled` + `?t=` 破缓存），
视口 320×568 / 375×667 / 390×844。所有数字为 `getBoundingClientRect()` 实测，非估算。
证据 JSON：`/tmp/ai-please-rowheight-evidence/{out,verify,final,result2,sweep3,clip}.json`。

## 0. 结论速览

| 优先级 | 位置 | 三档 Δ | 处置 |
| --- | --- | --- | --- |
| P0 | 护照面板头 `.pp-tier` vs `.pp-open` | 29.61 / 27.20 / 27.20 | 已修，Δ→0，主屏纵向 +0 |
| P1 | 教程底部 `.sheet-foot` 跳过说明 vs 下一步 | 3.00 / 3.00 / 3.00 | 已修，Δ→0，弹层 +3px |
| P1 | 首页/结算 `.home-buttons` 主按钮 vs 次按钮 | 6.00 / 6.00 / 6.00 | 已修，Δ→0，首屏仍不滚 |
| P2 | 结算格 `.result-cell` 行内基线（误拒绝 vs 总分） | 2.00 / 2.00 / 2.00 | 已修至 1.27（≤2px 容差） |
| P2 | 结算格跨行高度 47.75 vs 54.30 | 6.55 / 6.55 / 6.55 | 不改（结论文案提级是有意设计） |
| P2 | 抽屉表头 文本 vs 44px 关闭键 | 28.50 / 28.50 / 28.50 | 不改（文本 vs 触控目标，非同组控件） |
| P2 | 首页 day-chip 41→44 | 0 / 0 / 0（同组一致） | 已做：拉到 44 触控基准，首页仍不滚 |
| PASS | 状态栏三格 / 动作栏三键 / 印章两排 / 护照层 actions | 0 / 0 | 无需改动 |

改动落在 `src/styles/global.css`（五条规则，+40B gzip：审计三条 + 文字居中 + day-chip 44），
门禁：`tsc --noEmit` + `vite build` 通过、`npm test` 61/61、`verify:budget` 通过、
`verify:zh` exit 0（spans 411 ≥ 90、无横向溢出）、`verify:acceptance` 20/20 场景 431 断言通过。

## 1. 护照面板头 `.pp-tier` vs `.pp-open`（P0，已修）

| 视口 | `.pp-tier` | `.pp-open` | Δ | `.panel-head` |
| --- | --- | --- | --- | --- |
| 320×568 | 14.39 | 44.00 | **29.61** | 55.00 |
| 375×667 | 15.59 | 44.00 | **27.20** | 55.00 |
| 390×844 | 15.59 | 44.00 | **27.20** | 55.00 |

差的来源（两个控件各自的盒模型完全不同的驱动因素）：

- `.pp-tier` = 内容驱动：`line-height 1.2` × 字号（320 档 7px → 8.40；375/390 档 8px → 9.60）+ `padding 2px×2` + `border 1px×2` = 14.40 / 15.60（实测 14.39 / 15.59，亚像素舍入）。
- `.pp-open` = 规则驱动：`global.css:1726-1739` 的无障碍规则 `min-width/min-height:44px`。它自身的字号 8px + `padding 3px×2` + `border 1px×2` 只能撑到 17.6px，44px 纯由 a11y 下限给出。
- 头部高度 55 = 44 + `padding 5px×2` + `border-bottom 1px`，即 **行高早已被 `.pp-open` 顶满**，`.pp-tier` 只是没长满这一行。

修复：`.pp-tier { align-self: stretch; display: inline-flex; align-items: center }`。
`.panel-head` 是 `align-items:center` 的 flex 行，`align-self:stretch` 让 chip 吃到该行行高（44），文字由 flex 居中，
不依赖任何魔法行高。实测 320/375/390 均 44.00 / 44.00，Δ=0，`panel-head` 仍 55，`main.scrollHeight` 一档不变。

建议值 44 / 容差 ≤1px（同级控件）；代价 **+20B gzip**（67B raw）。

不收的方案：

- `.pp-tier { line-height: 38px }`：也到 44，但 38 是「44 − padding 4 − border 2」的硬编码，字号一变就错位。
- `.pp-tier, .pp-open { min-height: 40px }`：Δ 也能归零并把头部 55→51（省 4px），
  但它把项目既有的 44px 触控目标降到 40，等于用 a11y 换像素，否决。

英文锚点保住（约束③）：五种 tier 文案 `STANDARD / FLAGGED / DEEP CHECK / PRIORITY / CONTESTED`
在 320/375/390 三档全部实测 `scrollWidth == clientWidth`（无裁切），320 档最宽的 `DEEP CHECK` 需 51.95px、
盒宽 63.95px，余量 ≥10px；`≤360px` 媒体查询里的 `text-overflow:ellipsis` 因此不会被触发。
320 档文案仍是 `STANDARD`（`.bi-zh` 依既有规则隐藏），375/390 为 `STANDARD 常规`。

## 2. 状态栏三格 `.stat`（PASS）

| 视口 | 格1 | 格2 | 格3 | Δ |
| --- | --- | --- | --- | --- |
| 320 | 40.00 | 40.00 | 40.00 | 0 |
| 375 | 40.00 | 40.00 | 40.00 | 0 |
| 390 | 40.00 | 40.00 | 40.00 | 0 |

来源一致：`border 1px×2` + `padding 4px×2` + `.stat-label 13.5` + `.stat-value 20.25` = 40。同一 `.stat` 类，无分叉。

## 3. 动作栏三键 `.action-grid .btn`（PASS）

| 视口 | 拒绝 | 开档 | 放行 | Δ |
| --- | --- | --- | --- | --- |
| 320 / 375 / 390 | 52.00 | 52.00 | 52.00 | 0 |

52 由 `min-height:52px` 决定（内容只有 16 + 8 + gap 1 = 25，撑不满），三键同类同高。
`.btn-wide:46`、`.btn:52` 的差异是**不同组**按钮，不构成并排不一致。

## 4. 底部印章两排与护照层头部（PASS）

| 位置 | 320 | 375 | 390 |
| --- | --- | --- | --- |
| `.ppz-stamp-row .btn`（放行/拒绝） | 52.00 / 52.00 | 52.00 / 52.00 | 52.00 / 52.00 |
| `.ppz-actions .tag`（ZOOM / 关闭） | 44.00 / 44.00 | 44.00 / 44.00 | 44.00 / 44.00 |
| `.ppz-head` | 62.00 | 62.00 | 62.00 |

同一 `.btn` / 同一 `.tag.dim|.cyan`，高度由 a11y 44 与 `min-height:52` 统一决定，无内部分叉。

## 5. 结算格 `.result-cell`（P2，行内已修，跨行不改）

| 视口 | 判定正确 | 判定错误 | 开档次数 | 误放行 | 误拒绝 | 总分 | 预算结余 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 320 | 47.75 | 47.75 | 47.75 | 47.75 | 54.30 | 54.30 | 54.30 |
| 375 | 47.75 | 47.75 | 47.75 | 47.75 | 54.30 | 54.30 | 54.30 |
| 390 | 47.75 | 47.75 | 47.75 | 47.75 | 54.30 | 54.30 | 54.30 |

- 普通格 47.75 = `border 1×2` + `padding 6×2` + `.k 13.5` + `.v 20.25`。
- 结论行 54.30 = `border 2×2` + `padding 7×2` + `.k 13.5` + `.v 22.80`（`global.css:1024-1031` 有意提级：
  「分数与结余是一局的落点，不该和诊断指标同权」）。
- 跨行 Δ6.55 = 边框 +2 + 内边距 +2 + 值字号 15→19 的 +2.55。**产品意图，不改。**
- 真 bug 是行内错位：`误拒绝` 是普通格却被 grid 拉伸到 54.30，内容顶对齐（top offset 7），
  与同行 `总分` 的 9 差 2.00px。`display:flex; flex-direction:column; justify-content:center` 让被拉伸的格子在自身盒内居中，
  盒子高度一个都没变（grid 总高恒 222.09），错位 2.00 → **1.27px**，落在 ≤2px 容差内。
- 若要把残差压到 0，只能连 `.v` 字号一起抹平（等于取消结论提级），否决。

建议值：跨行差保留 6.55（文档化）；行内基线错位 ≤2px。代价 **+6B gzip**（32B raw）。

## 6. 抽屉表头关闭键（P2，不改）

| 视口 | `.sheet-head` | 文本 span | 关闭按钮 | Δ |
| --- | --- | --- | --- | --- |
| 320 / 375 / 390 | 64.00 | 15.50 | 44.00 | 28.50 |

差的来源：文本 10px × `line-height 1.5` = 15px（+ 行盒 0.5 取整）；按钮被 a11y 规则顶到 44。
这是「文本 vs 触控目标」，不是两个并排控件打架——`align-items:center` 已经保证两者同轴。
曾测过收紧 `.drawer .sheet-head{padding-block:0}`：head 64→46，+10B gzip，但 44px 按钮会贴边，视觉更紧更挤。
建议保持现状；容差：文本与控件同轴、错位 ≤2px。

## 7. 教程底部按钮行 `.sheet-foot`（P1，已修）

| 视口 | 跳过说明 `.btn-ghost` | 下一步 `.btn-wide` | Δ | `.sheet-foot` |
| --- | --- | --- | --- | --- |
| 320 / 375 / 390（修复前） | 43.00 | 46.00 | **3.00** | 119.00 |
| 320 / 375 / 390（修复后） | 46.00 | 46.00 | 0 | 122.00 |

差的来源：`.btn-ghost` 的 `min-height:40` 没生效在高度上——它的内容是「中文行 11 + 英文行 14 + gap 1」= 25，
加 `padding 7×2` + `border 1×2` ⇒ 43，比 `min-height` 高，于是自己被内容顶到 43；`.btn-wide` 被 `min-height:46` 顶住。
统一到 46（与全站 `.btn-wide` 同基准）：`.sheet-foot .btn { min-height: 46px }`，Δ=0，弹层 +3px（不占主屏）。

## 8. 首页 day-chip 与按钮（P1 已修 + P2 可选）

| 视口 | day-chip ×4 | 开始游戏 | 玩法说明 | Δ | 首页 docScrollH / clientH |
| --- | --- | --- | --- | --- | --- |
| 320（修复前） | 42.00 ×4 | 46.00 | 40.00 | **6.00** | 568 / 568（正好不滚） |
| 320（修复后） | 42.00 ×4 | 46.00 | 46.00 | 0 | 568 / 568（仍不滚） |
| 375 / 390 | 同上 | 46.00 | 46.00 | 0 | 667/667、844/844 |

- `.home-buttons` 是 `flex-direction:column` 的竖排，严格说不属「并排」，但视觉上是一条按钮队列，
  46 与 40 混排最扎眼，一并对齐到 46：`.home-buttons .btn { min-height: 46px }`（+9B gzip 与上一条共用规则）。
  结算页 `.result .home-buttons`（再玩一次 46 / 返回主菜单 40）是同一个类，被同一条规则一起修掉，实测 46/46。
- day-chip 42 = 10px 字 + `padding 6×2` + `border 2×2`，四个同值、同组一致（Δ=0）；
  但 42 < 44 触控基准。P2 可选：`.day-pick .day-chip{min-height:44px}`，+5B gzip，该行 +2px（首页仍不滚）。

## 9. 8 处之外还扫出了什么

用「垂直重叠聚类」扫了全站所有 flex/grid 行（不按 top 分组，避免 center 对齐被误判成不同行），
额外命中并逐条判定：

| 位置 | Δ | 判定 |
| --- | --- | --- |
| `.pp-id` 头像 74 vs 元信息块 70.34 | 3.66 | 接受：`align-items:flex-start` 顶对齐，底部余量不同但无可见错位（要消差可 `.pp-id-meta{min-height:74px}`，+7B） |
| `.brand` 内 mark 19.5 vs day 13.5 | 6.00 | 接受：`align-items:baseline`，视觉正确 |
| 顶栏 brand 19.5 vs `status-clock` 16.5 | 3.00 | 接受：baseline 对齐 |
| `.panel-title` 13.5 vs `.tag` 15.59 / 16.8 | 2.09 / 3.30 | 接受：文本 vs chip，center 对齐；强行等高会把标题撑高 |
| `.ppz-head` 文本 15 vs `.ppz-actions` 44 | 29.00 | 接受：同抽屉，文本 vs 触控目标 |
| `.locked` 行 1px 细线 vs 15px 文本 | 14.00 | 忽略：装饰线，不是控件 |
| `.rule-item` 51.44 vs 67.38 | 15.94 | 忽略：文案换行导致，非同组控件 |
| `result-head` 12 / 28.59 / 12 | 16.59 | 接受：kicker / 评级 / 副标题是三个层级，center 对齐 |

## 10. 容差与验收口径（建议写进设计规范）

- **同级并排控件**（同为按钮 / chip / 统计格）：目标 Δ=0，容差 **≤1px**（只允许亚像素舍入）。
- **跨层级并排**（文本 vs 控件、标题 vs chip）：不要求等高，要求**同对齐轴**（`center` 或 `baseline`），视觉错位 **≤2px**。
- **同一 grid 行内不同权重的格子**：内部基线错位 **≤2px**。
- **触控目标**：≥44px（`global.css:1726-1739` 既定），任何等高改造不得下调；要降到 40 必须整站统一并过 a11y 评审。

## 11. 纵向预算（约束①）与 CSS 预算（约束②）实测

| 指标 | 320 | 375 | 390 |
| --- | --- | --- | --- |
| `main.scrollHeight` 改前 → 改后 | 594 → 594 | 594 → 594 | 624 → 624 |
| `.panel-head` 改前 → 改后 | 55 → 55 | 55 → 55 | 55 → 55 |
| 首页 `docScrollH / clientH` | 568/568 → 568/568 | 667/667 | 844/844 |
| 结算 grid 总高 | 222.09 → 222.09 | 同 | 同 |
| 横向溢出 | 0 → 0 | 0 → 0 | 0 → 0 |

- 主屏（320）纵向增量 **0**。
- 教程弹层 `.sheet-foot`：119 → 122（+3，仅弹层内）。
- 首页按钮列 +6px 内容，但 320 首页仍 `568/568` 不产生滚动。

CSS 预算（`npm run verify:budget` 实测）：

```
[首屏CSS] 5.86kB / 6.2kB  (94.5%)   补丁前 5.85kB
```

补丁总代价 **+35B gzip / +190B raw**（`.pp-tier` 20B + 按钮规则 9B + `.result-cell` 6B），
剩余额度约 **305B**。

## 12. 未做 / 风险

- 本机 `git` 二进制损坏（`/usr/local/bin/git: Bad CPU type in executable`），无法 `git status/diff`，**未提交**。
- `.pp-tier` 从 `inline-block` 改为 `inline-flex` 后，`text-overflow:ellipsis` 在极端长文案下不会触发（flex 容器对匿名文本项不生效）。
  已用全部 5 种真实 tier 文案 × 3 档实测无裁切；若未来新增更长的 tier 词，需复查 320 档（阈值约 62px 可用宽度）。
- 结算格跨行 6.55px 差异保留，属产品意图；如需彻底等高，须改 `.conclusion` 提级策略（改设计，不改 CSS）。

## 8. 落地时追加的两处（审计之外，Lead 复核时发现）

| 项 | 现象 | 处理 | 代价 |
| --- | --- | --- | --- |
| `.pp-open` 文字顶对齐 | 盒 44px、标签中心比盒中心高 **13.2px**（`display:inline-block` + `min-height` 的空腔全在文字下方） | `.pp-open{display:inline-flex;align-items:center;justify-content:center}` | +8B gzip |
| `.pp-open` 文案粘连 | 照片化后 `<span class="cn">护照</span>` 与裸文本 `PASSPORT` 之间的空白被 flex 吞掉，渲染成「护照PASSPORT ▸」 | 把英文包进 `<span class="bi-en">PASSPORT</span>`，复用既有 `.cn + .bi-en{margin-left:6px}` | 0B（复用既有规则） |

结论文本改动（`PassportDoc.tsx`）与 CSS 改动必须同批上线：只加 `.bi-en` 不改结构会多出一个 6px 间隙，只改 CSS 不包 `bi-en` 则文案仍粘连。

## 9. 验收口径（本轮新增 3 条断言，共 431）

```
assert |h(.pp-tier) − h(.pp-open)| ≤ 1px      // 同行同类控件等高
assert |top(.pp-tier) − top(.pp-open)| ≤ 1px   // 顶边对齐（防「等高但不齐」）
assert |centerY(.cn) − centerY(.pp-open)| ≤ 2px // 文字垂直居中（防「等高但文字顶对齐」）
```

三条缺一不可：只测高度会被「等高但文字仍顶对齐」骗过，只测居中会被「居中但盒子不等高」骗过。
