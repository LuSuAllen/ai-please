# Passport Sheet · 访客护照浮层设计规格

> 目标：在现有像素终端语言内新增一个"护照页"浮层，玩家可放大查看、直接盖章放行/拒签。
> 全部数值基于 `src/styles/global.css` 现有令牌，不新增字号、不新增色值、零圆角、2px 边、硬阴影、扫描线、像素字。

## 0. 已核对的代码事实（设计前提）

| 事实 | 位置 | 对设计的影响 |
| --- | --- | --- |
| `--pad: 12px`，`.overlay { padding: 16px }` | global.css:24, 725 | 浮层可用宽度 = 视口宽 − 32 |
| `.stage` 移动端宽 100%、桌面 `aspect-ratio 9/16` 且 `max-width: none` | global.css:77-120 | 宽度必须流体，不能写死 390 |
| `.stage::after` 扫描线 `z-index: 60` | global.css:90-104 | **z=65 以上的浮层都没有扫描线**；护照必须自带一层 |
| `.overlay` z=70、`.drawer` z=80、toast z=65、`.actionbar` z=30 | global.css:720, 771, 1076, 622 | 护照落在 65–70 之间 |
| `STAMP_MS = 900` 已定义但**从未被引用** | engine.ts:18 | 盖章动画总时长直接绑定 900ms，让常量复活 |
| `Visitor` 无护照号/签发地/有效期/历史章字段 | types/game.ts:31-60 | 必须派生，且派生函数不得读取 `correct`/`signals` |
| `prefers-reduced-motion` 把动画压到 0.01ms | global.css:1226-1234 | 动画**不能**用 `animationend` 串流程，必须用 JS 定时器 |
| `.btn:active` 用 `steps(2, end)`、`.drawer-panel` 用 `steps(4, end)` 160ms | global.css:651, 787 | 缩放与盖章动效沿用 steps，不用 ease |

---

## ① 布局网格与尺寸

### 1.1 尺寸（两个断点，硬编码，护照是"文档"不是流式面板）

| 量 | 390×844 | 320×568 |
| --- | --- | --- |
| 浮层可用区（viewport − overlay 16×2） | 358 × 812 | 288 × 536 |
| `.pp-sheet` 宽 | 358 | 288 |
| `.pp-sheet` 高 | 620 | 536 |
| `.pp-head` 高（flex:none） | 34 | 34 |
| `.pp-body` 高（flex:1，文档页） | 512 | 428 |
| `.pp-foot` 高（flex:none，含边框） | 74 | 74 |
| `.pp-foot` 内 padding | `10px 11px calc(env(safe-area-inset-bottom,0px) + 10px)` | 同 |
| 内容区宽（sheet − 2×2 边 − 2×11 padding） | 332 | 262 |
| 桌面 ≥431px 视口 | 维持 358 宽居中，`max-width: calc(100vw - 32px)` 兜底 | — |

`.pp-sheet` 用 `height` 固定值而非百分比：缩放数学需要确定高度，且保证盖章按钮永远在首屏（640/720 是"页面感"而不是"撑满"）。
安全区只增长 `.pp-foot`，`.pp-body` 用 `flex:1; min-height:0` 自动收缩，不溢出。

### 1.2 纵向网格（从 `.pp-body` 内容顶 = 0 开始）

| 区块 | 390 | 320 | 说明 |
| --- | --- | --- | --- |
| 页内 padding-top | 11 | 11 | 复用 `.sheet-body` 的 11 |
| `.pp-identity`（头像 + 姓名/别名/编号） | 11–119（h 108） | 11–103（h 92） | `grid-template-columns: 84px 1fr; column-gap: 10px` |
| gap | 10 | 8 | |
| `.pp-fields`（3 行 × 2 列） | 129–249（h 120） | 111–231（h 120） | `grid-template-columns: 1fr 1fr; gap: 8px`；行高 40 |
| gap | 10 | 8 | |
| `.pp-signals`（自带决策信息，1 行） | 259–281（h 22） | 239–261（h 22） | 见 4.3：防"浮层挡住自己需要的信息" |
| gap | 10 | 8 | |
| **`.pp-archive`（印章区）** | **291–413（h 122）** | **269–375（h 106）** | 见 1.3 |
| `.pp-mrz`（机读码带） | 469–501（h 32） | 385–417（h 32） | `margin-top: auto` 顶到底，吸收 390 的 56px 余量 |
| 页内 padding-bottom | 11 | 11 | |

盖章区位置结论：**内容顶向下 269–291px，印章按钮在 `.pp-foot`（body 之外）**——即使 320 下页面被压到 428，印章历史区仍在首屏内完整可见（375 < 428）。

### 1.3 印章区（历史章）

```
.pp-archive { border: 2px solid var(--line); background: #0a1120; padding: 6px; }
.pp-stamp-grid { display: grid; gap: 6px; }
/* ≥351px */ grid-template-columns: repeat(4, 1fr);  /* (332−18)/4 = 78 */
/* ≤350px */ grid-template-columns: repeat(3, 1fr);  /* (262−12)/3 = 83 */
.pp-slot { height: 46px; }   /* 320 断点 → 38px */
```
槽位宽 78（390）/ 83（320），迷你章 `font-size 9px; letter-spacing .16em; border 2px; padding 2px 4px` → 章宽 8×6.84 + 8 + 4 = **66.7px**，两个断点都不溢出。
空槽：`border: 1px dashed rgba(45,66,100,.45)`，内文 `EMPTY` 8px `--ink-faint`。

### 1.4 头像与文字阶梯

| 元素 | 值 |
| --- | --- |
| `.pp-photo` 框 | 84 × 108（390）/ 84 × 92（320），`border: 2px solid var(--line-2)`，`box-shadow: inset 0 0 0 2px #0a1220` |
| `PixelAvatar size` | 84（复用现有组件，12:14 viewBox 自动 letterbox，与 `.visitor-portrait` 同法） |
| 姓名 | 15px / 700 / letter-spacing .04em（现有 `.visitor-name` 值） |
| 别名 | 9px / .16em / `--ink-faint` |
| 编号 `V-00X` | 9px / .18em / `--cyan` |
| 字段 label | 8px / .18em / `--ink-faint` / uppercase |
| 字段 value | 12px / `tabular-nums`，单行 `text-overflow: ellipsis` |
| 字段 value-sub | 8px / .12em / `--ink-faint` |
| 信号行 | 11px |
| MRZ | 9px /.08em（≥341）/ 8px /.08em（≤340） |
| 迷你章 | 9px / .16em / 700 |
| 大章 | 26px / .22em / 700 / 3px 边（复用 `.result-grade` 的 26 与 `.stamp` 的结构） |

字号只用现有阶梯 {8, 9, 10, 11, 12, 15, 26}，**不新增**。
MRZ 宽度验算（SF Mono advance = 0.6em）：44 字符 × (9×0.6 + 9×0.08) = 269 ≤ 332 ✓；320 断点 44 × (8×0.6 + 0.64) = 239 ≤ 262 ✓。

### 1.5 印章按钮（`.pp-foot`）

```
.pp-foot { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
```
| 量 | 390 | 320 |
| --- | --- | --- |
| 单按钮宽 | (358−4−22−8)/2 = 162 | (288−4−22−8)/2 = 127 |
| 按钮高 | 52（`.btn` 现有 min-height） | 52 |
| 文案 | `APPROVED` / `REFUSED`（11px/700/+small 7px） | 同 |

`REFUSED` 7 字符 × 6.82 = 47.7 + padding 8 = 55.7 ≤ 127 ✓。
按钮复用 `.btn .btn-approve` / `.btn .btn-deny` 的配色，**不新增配色**。

### 1.6 派生字段（不读引擎答案）

| 字段 | 派生 | 是否泄漏答案 |
| --- | --- | --- |
| 护照号 | `pno = String((avatarSeed * 2654435761) % 9000000 + 1000000)`，显示 `PL 4827 319` | 否，仅读 avatarSeed |
| 签发地 | `REGION_MAP[visitor.accountRegion].name` + `BU-04` | 否，accountRegion 已在 APPLICATION DATA 明文可见 |
| 有效期 | `DAY 001 → DAY 090`（世界内时间，不用真实日期） | 否，10 位访客跳转均为固定值 |
| 历史章 | `n = avatarSeed % 4`；每章取 `REGIONS[(seed >> k*3) % 6]`、`k % 2 ? APPROVED : REFUSED`、`DAY 0(k+2)` | 否，**只读 avatarSeed**，不读 `correct`/`signals`/`ipRegion` |
| 当前章 | 玩家操作后插入槽位 0，`is-live` | — |

硬约束：派生函数签名为 `derivePassport(visitor) → PassportData`，函数体内**禁止出现** `correct`、`signals`、`hiddenClues`、`explanation`。历史章区右上一律标 `ARCHIVE · 非本局记录`（8px `--ink-faint`）。

---

## ② 放大交互（1.6x）

### 2.1 数学（无重排、精确 1.6）

`.pp-body` 内部唯一一层缩放，不改变任何文本换行：

```
.pp-zoomvp  { position: relative; width: 100%; height: 100%; overflow: hidden; touch-action: pan-y; }
.pp-zoombox { width: calc(100% * var(--z)); height: calc(100% * var(--z)); }
.pp-doc     { width: calc(100% / var(--z)); height: calc(100% / var(--z));
              transform: scale(var(--z)); transform-origin: 0 0; }
.pp-body.is-zoom { overflow: auto; overscroll-behavior: contain; touch-action: pan-x pan-y; }
```
`--z` 默认 1（此时 box / doc 都是 100%/100%，`scale(1)`，零副作用），`.is-zoom` 时 `--z: 1.6`。
滚动范围天然正确：box = 160% 视口，doc 视觉尺寸 = 160% 视口 → 可滚动量 = 0.6 × 视口（横向 199px、纵向 307px @390）。

### 2.2 缩放中心（点哪放大哪）

点击点相对 `.pp-body` 的坐标为 `(tx, ty)`，当前 `(scrollLeft, scrollTop)`：

```
ox = scrollLeft + tx        // 目标内局部坐标
oy = scrollTop  + ty
doc.style.transformOrigin = `${ox}px ${oy}px`
scrollLeft = clamp(ox * 1.6 - vw / 2, 0, vw * 0.6)
scrollTop  = clamp(oy * 1.6 - vh / 2, 0, vh * 0.6)
```
`vw/vh` = `.pp-body` 的 `clientWidth/clientHeight`。退出时 `transform-origin` 复位 `0 0`，滚动复位到进入前的 `(scrollLeft, scrollTop)`（保存在 `useRef`，退出精确回到原位，不是顶部）。

### 2.3 触发

| 方式 | 判据 | 代价 |
| --- | --- | --- |
| 单击切换 | Pointer 位移 ≤ 8px 且时长 ≤ 250ms，且 `e.target.closest('[data-no-zoom]') === null` | 12 行 |
| 双指缩放 | 2 个 pointer 距离 d 与 d₀ 之比，实时写 `--z = clamp(1, 1.6, d/d₀)`（不加过渡）；抬手吸附：scale ≥ 1.3 → 1.6，否则 1.0 | +40 行 |
| 键盘 | `Escape` 退出放大；`F` 切换 | +6 行 |

`data-no-zoom` 必须打在：`.pp-head`、`.pp-foot`、`.pp-slot`、所有 `button`。
未实现双指时的降级：单击切换即满足需求（1 次点击 = 1.6x）。

### 2.4 退出

1. 再点一次文档 → 回 1.0，滚动回原位；
2. `.pp-head` 的 `FIT` 标签（放大态从 `1.6×` 变 `FIT`，8px tag，44×44 热区用 `::after { inset: -5px -12px }` 撑出）；
3. `Escape`；
4. 关闭护照浮层 → `--z` 复位 1、`transform-origin` 复位；
5. 双指捏回 < 1.3 → 吸附 1.0。

### 2.5 与滚动/浏览器手势的冲突

| 冲突 | 处理 |
| --- | --- |
| 1.0 态横向拖动误触 | `touch-action: pan-y`，横向手势被浏览器丢弃 |
| 1.6 态纵向/横向平移 | `touch-action: pan-x pan-y` + `overscroll-behavior: contain`（不链到 `.main`、不触发下拉刷新） |
| 浏览器整页双指缩放 | `touch-action` 已声明，浏览器 pinch 不生效 |
| 拖动手势被识别成"点击切换" | 位移 > 8px 或时长 > 250ms 即判定为拖动，不切缩放 |
| 放大后误章 | 盖章按钮在 `.pp-body` 之外，始终可点，不受缩放/平移影响 |
| 放大态关闭时残留滚动位置 | 关闭时统一重置 `--z`/origin/scroll |

过渡：`--z` 切换用 `transition: transform 160ms steps(4, end), width 160ms steps(4, end), height 160ms steps(4, end)`（复用 `.drawer-panel` 的 160ms/steps(4) 节奏）。`prefers-reduced-motion` 下全局规则已压到 0.01ms，无需额外处理。

---

## ③ 盖章动画（总时长 900ms = `STAMP_MS`）

### 3.1 分阶段

| 阶段 | 起止 | 动画 | 缓动 |
| --- | --- | --- | --- |
| P0 待机 | 0 | 章节点 `opacity: 0` | — |
| P1 落章 | 0–140ms | `translateY(-18px) rotate(-16deg) scale(2.2)` → `translateY(-6px) rotate(-11deg) scale(1.55)`，`opacity 0→1` 在 90ms 完成 | `steps(4, end)` |
| P2 砸下 | 140–260ms | `scale 1.55→0.94`（240ms 处）、`rotate -11°→-7°` | `steps(3, end)` |
| P3 回弹 | 260–380ms | `scale 0.94→1`、`rotate -7°→-6°`（与现有 `.stamp-in` 终态完全一致） | `steps(2, end)` |
| P4 冲击环 | 260–460ms | `box-shadow: 0 0 0 0 rgba(color,.55)` → `0 0 0 10px rgba(color,0)`；opacity 1→0 | `linear` |
| P5 墨迹颗粒 | 300–520ms | `mask-image: repeating-linear-gradient(45deg,#000 0 2px,transparent 2px 5px)`，`--ink: 0→0.18`；同期节点 `opacity 1→.78→1` | `steps(2, end)` |
| P6 页面震动 | 140–220ms | 用独立属性 `translate: 0 0 → 1px -1px → -1px 1px → 0 0`（**不碰 `transform`，不打断缩放**） | `steps(3, end)` |
| P7 移交 | 900ms | JS 定时器触发：护照 sheet `fade-out 120ms steps(3,end)`，`FeedbackOverlay` 挂载 | — |

REFUSED 章镜像：`rotate` 全取正号（+16°→+6°），配色 `--red`。

### 3.2 实现代价

| 项 | 值 |
| --- | --- |
| CSS 新增 | ~60 行（7 组 keyframes + 1 个 `@keyframes fade-out` + 状态类） |
| CSS 能否完成 | **能，纯 CSS**。P1–P6 全部只动 `transform` / `opacity` / `box-shadow` / `mask-image` / `translate`，无 layout 抖动；`translate` 独立属性与 `transform: scale()` 互不覆盖（Baseline 2022，Chrome 104+/Safari 14.1+） |
| JS | 仅 1 处：`setTimeout(..., STAMP_MS)` 推进阶段，**不用 `animationend`**（`prefers-reduced-motion` 会把动画压到 0.01ms，监听它会导致跳过动画直接跳转） |
| React 状态 | 1 个 `stamp: { kind: 'APPROVED'|'REFUSED', at: number } \| null` |
| 合成层 | 2 层 `will-change: transform, opacity`（大章、页面震动包装层），`box-shadow` 只作用于 160×60 的节点，paint 成本可忽略 |
| reduced-motion | 保持 900ms 时序，仅动画失效；`matchMedia` 为真时把 `--stamp-ms` 改 300ms 并同步 JS 常量，避免等待空转 |
| 依赖 | 0 新增 |

---

## ④ 与 FeedbackOverlay 的关系 + z-index

### 4.1 结论：**先盖章，再弹反馈，不合并**

| 方案 | 判定 | 理由（可量化） |
| --- | --- | --- |
| 合并成一张卡 | 否 | ① 同屏出现 `APPROVED`（世界内）与 `WRONG`（审计）两种相反结论，违背现有 `.stamp` 单一主视觉；② 320×568 下 `.pp-sheet` 620 内容 + 反馈区 ≥ 300 → 总高 ≥ 920 > 536，`NEXT VISITOR` 按钮必然掉出首屏；③ 评分口径会出现两个来源（护照与反馈各一套），违背 `SCORE_TABLE` 单一来源 |
| 先盖章 → 900ms 后弹反馈 | **是** | 护照负责"动作"，反馈负责"裁决"，时序分离，各自满屏可读；`FeedbackOverlay` 一行不改，评分单一来源保持不变 |

### 4.2 状态机（不改 reducer）

```
playing + 护照开启
  → 点 APPROVED/REFUSED：dispatch MOVE(APPROVE|DENY)（立即结算，ActionBar 因 phase!=='playing' 自动 disable）
  → 本地 stamp 状态置位，跑 900ms 动画
  → t = 900ms：FeedbackOverlay 挂载（z=70 > 护照 68，交叉淡入 120ms）
  → t = 1020ms：护照卸载
```
唯一的接线改动：`GameScreen.tsx` 反馈渲染条件加一个闸门
`state.phase === 'feedback' && state.lastRecord && stampSettled`（+1 行 + 1 个 props）。

### 4.3 z-index 分配

| z | 元素 | 变更 |
| --- | --- | --- |
| 30 | `.actionbar` | 不变（被护照 backdrop 覆盖，`pointer-events` 由 backdrop 拦截） |
| 60 | `.stage::after` 扫描线 | 不变。**注意：它不覆盖任何 ≥70 的浮层**，所以护照自带扫描线层 |
| 65 | `.toast-wrap` | 不变 |
| **68** | **`.pp-overlay` + `.pp-sheet`（新增）** | 新增 |
| 70 | `.overlay`（FeedbackOverlay / ModeChoice） | 不变 |
| 80 | `.drawer`（RuleDrawer） | 不变 |

选 68 而非 75：反馈必须压在护照之上，把新层插在 65–70 之间可以做到**零改动现有层级**。
副作用与对策：toast（65）会被护照盖住 → 护照入口加前置条件 `state.pendingUpdate === null`（与 ActionBar `disabled` 同一判据），从根上排除"toast 与护照同屏"。

护照内部层级：`.pp-doc` z=1、扫描线伪元素 z=2（`pointer-events:none`，渐变与 `.stage::after` 同参数：3px/4px、`rgba(0,0,0,.22)`、`opacity .5`）、`.pp-head`/`.pp-foot` z=3。

### 4.4 入口

不新增第 4 个 ActionBar 按钮（`.action-grid` 是 3 列，320 下加列会压到 127→92）。入口两个：

1. `VisitorCard` 的 panel-head 里追加 `<button class="tag cyan">PASSPORT ▸</button>`（不改变面板高度）；
2. 点 `.visitor-portrait`（62×74，已在 44px 目标之上）。

两处都 dispatch 同一个 `onOpenPassport()`；护照内的章与 ActionBar 的 DENY/APPROVE 走同一个 `onMove(Move)`。

---

## ⑤ 验收清单（可量化）

| # | 验收项 | 判据 | 方法 |
| --- | --- | --- | --- |
| 1 | 无横向溢出 390 | `document.documentElement.scrollWidth === clientWidth === 390` | DevTools / `chrome-cdp-mobile-probe` |
| 2 | 无横向溢出 320 | 同上，`=== 320` | 同上 |
| 3 | 无横向滚动条 | `.stage`、`.main`、`.pp-body` 的 `scrollWidth ≤ clientWidth`（1.0 态） | `for` 循环遍历 |
| 4 | 任一子元素不出界 | 所有 `.pp-*` 节点 `getBoundingClientRect().right ≤ sheet.right`，`left ≥ sheet.left` | 脚本断言 |
| 5 | 盖章按钮首屏可点 | 两个按钮 `rect.bottom ≤ innerHeight`、`rect.top ≥ 0`、`rect.height ≥ 44` | 同上 |
| 6 | 按钮未被遮挡 | 两按钮中心点 `document.elementFromPoint(cx, cy)` 命中按钮自身 | 同上 |
| 7 | MRZ 不溢出 | `.pp-mrz` `scrollWidth ≤ clientWidth`（390 与 320 各一次） | 同上 |
| 8 | 印章槽不溢出 | 每个 `.pp-slot` `scrollWidth ≤ clientWidth` | 同上 |
| 9 | 缩放到恰好 1.6 | `.pp-doc` 视觉宽 / 视口宽 = **1.600 ± 0.010** | `rect.width / body.clientWidth` |
| 10 | 缩放不重排 | 放大前后 `.pp-name` 的 `clientHeight` 与字符数不变；`scrollHeight` 只有在 box 缩放后才变化 | 断言 |
| 11 | 点哪放哪 | 点击点 `(tx,ty)` 放大后，该点在屏幕上的位移 ≤ 24px（±vw/2 居中误差以内） | 截图对比 |
| 12 | 缩放不与滚动冲突 | 1.0 态纵向拖动 200px：`body.scrollTop` 不变（不滚动），`--z` 仍为 1；1.6 态纵向拖动 200px：`scrollTop` 增加 ≈ 200，`--z` 仍为 1.6 | 触摸序列回放 |
| 13 | 退出精确复位 | 退出后 `--z === 1`、`transformOrigin === '0px 0px'`、`scrollLeft/Top` 回到进入前值（±1px） | 断言 |
| 14 | 时序正确 | `t=0` 派发 MOVE、`t=880ms` 时 FeedbackOverlay 不存在、`t=960ms` 时存在、`t=1040ms` 护照已卸载 | `performance.now()` 打点 |
| 15 | 层级正确 | 反馈挂载瞬间：`.pp-sheet` 的 z=68 < `.overlay` 的 z=70；`elementsFromPoint(中心)` 首元素属于 FeedbackOverlay | 断言 |
| 16 | 对比度 AA | `--green #3ef08a` on `#0a2416` = **11.0:1**；`--red #ff5470` on `#230a11` = **6.0:1**；`--ink-faint #7c8ea9` on `#0b1220` = **5.5:1**（均按 sRGB 相对亮度计算） | 计算 + 抽查 |
| 17 | 键盘可达 | Tab 顺序 = 3 站：`INSPECT` → `FIT` → `CLOSE`，再加 2 个章按钮；`:focus-visible` 为 `2px solid var(--cyan)` | 手动 |
| 18 | 不泄漏答案 | 10 位访客逐一开启护照，历史章组合与 `visitor.correct` 无函数关系（`derivePassport` 源码中 grep 不到 `correct`/`signals`） | `grep` + 目视 |
| 19 | 视觉语言一致 | 全浮层 `border-radius: 0`；边宽 ∈ {1,2,3}；阴影为 `Npx Npx 0 0` 硬阴影；无 `backdrop-filter`（护照自身不加，只有现有 `.overlay` 的 1px 保留） | 计算样式抽查 |
| 20 | 动效可降级 | 强制 `prefers-reduced-motion: reduce`：无动画，但流程仍在 300ms 内完成移交 | DevTools 模拟 |

---

## 6. 代价与风险

| 项 | 估计 |
| --- | --- |
| 新文件 | `src/components/PassportSheet.tsx`（≈150 行） |
| 改动文件 | `GameScreen.tsx` +6 行、`VisitorCard.tsx` +8 行、`types/game.ts` +6 行、`global.css` +200 行 |
| 新增依赖 | 0 |
| 产物增量 | ≈ +5.2KB raw / +1.8KB gzip（未构建实测） |
| 未决风险 | ① 固定 358/288 宽在 ≥431px 桌面舞台（517 宽）会留大边距，需视觉确认是否接受"文档浮在舞台中央"；② 双指缩放若不做，需求里的"双指"一项需产品确认可降级为单击；③ `translate` 独立属性在 iOS 14 以下无支持，震动退化为无动画（不报错）。 |

---

## 附录 A · 实现差异（2026-10-24 落地后回填）

> 本文件是评审期的设计规格。实际实现有 4 处偏差，全部为可追溯的主动决定，不是遗漏。

| # | 规格 | 实现 | 依据 |
| --- | --- | --- | --- |
| A1 | 护照做成浮层 `.pp-sheet`（390 下 358×620） | 内页 **inline 常驻**（`PassportDoc.tsx`），只有"放大"才是浮层（`PassportZoom.tsx`，`.pp-overlay` z=68） | CPO 的 P0 条件只要求"吸收 APPLICATION DATA、不新增第三套信息"；inline 已满足，且省一次点击、直接回应"信息很拥挤" |
| A2 | 章位只读，盖章留在底部三键 | 章位可点 → 打开放大层盖章；底部三键仍然保留 | 用户原话要求"放大查看护照并盖章或者拒签"，交互入口必须存在 |
| A3 | 打开默认 1.6× 放大 | 打开默认 **FIT 1.000**，点文档任意点放大到 1.600，再点复位 | 1.6 默认裁掉文档右半边（实测 `docVisualW 579 vs bodyW 362`），首屏读不全 |
| A4 | `.rule-toggle` 留在 `.main` 内 `sticky bottom` | `RuleToggle` 移出 `<main>`，成为 `.stage` 直接子元素（`margin: 0 var(--pad) 8px; z-index: 12`） | sticky 时在 1280×800 压住 DEEP FILE 最后一行线索；移出后规则条常驻且**永不遮挡内容** |

保留的规格全部落地：z=68 插在 toast(65) 与 feedback(70) 之间、`--z` 撑开 + 反向缩回再 `scale` 的不重排放大、盖章总时长绑定 `STAMP_MS = 900`、**不监听 `animationend`**（reduced-motion 会压到 0.01ms，改用 `setTimeout`）、先章后反馈、字号只用现有阶梯、零圆角 2px 边。

实测补充（原规格未覆盖）：

- 印章对比度：绿 `#3ef08a` on `#0a2416` = **10.99:1**（目标 11.0），红 `#ff5470` on `#230a11` = **5.82:1**（目标 6.0）。
- 盖章到反馈实测间隔 **920 / 938 / 942 ms**（`STAMP_MS 900` + 渲染抖动）。
- `@media (max-width: 360px)` 隐藏 `.pp-tier`，并把 `.pp-panel .panel-title` 设为 `nowrap + ellipsis`，解决 320 下标题换行（实测 320/360/375/390/414 标题高均 14px、head 35px）。
- 密封态 DEEP FILE 才加 `.capped { max-height: 168px }`（吃掉高屏负空间）；开档后不限高，避免裁剪线索。
