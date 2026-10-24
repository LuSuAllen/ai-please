# 关卡随机化 · 技术方案（CTO 评审稿）

- 状态：待评审 · 本轮只产出方案，不改 `src/`
- 日期：2026-10-24
- 决策人：CTO
- 范围：3 天 / 30 个访客位（蓝图可扩）+ seeded 随机化 + 存档 v3（种子 + 快照）+ 测试体系
- 不做（Non-goals）：后端 / 在线排行榜 / 新规则体系 / 每日挑战 / 美术重做 / 多语言

---

## 0. 结论先行

| # | 决策 | 一句话理由 |
| --- | --- | --- |
| 1 | **随机的是"局"，不是"规则"**：seed 只决定访客组合、字段取值、卡池抽取；规则文本、判罚数值、评分公式仍是硬编码单源 | 规则随机 = 玩家学不到东西；评分随机 = 成绩无法比较 |
| 2 | **答案由规则求值器在生成期算出，模板不写 `correct`** | 手写答案与线索必然漂移，"生成出无解题"只能靠 let-the-rules-judge 根治 |
| 3 | **生成器必须过校验器；校验不过重试，重试不过降级，绝不发无效局** | 随机系统的失败模式必须显式收敛，不能靠"应该不会" |
| 4 | **存档 = 种子 + 整局快照**（不是只存种子） | 文案改版后重放必然 drift；快照让"玩家看到的这一局"永远可续，且省掉生成器版本纪律 |
| 5 | **特殊事件与规则冲突走手工卡池，按 seed 抽取注入固定槽位；随机只发生在普通/异常/需开档** | 这两类是叙事高峰，程序生成必是二流货；且优先级推理程序化必出歧义 |
| 6 | **3 天 ×（8/10/12）= 30 位，一次性 6.5 人日** | 第 4–5 天需要新卡池才不是量增，边际收益低；蓝图已按可扩设计，加天只加配置 |

一句话版本：**把"写 10 张卡"换成"写 14 个生成模板 + 6 张手工卡 + 1 个会用规则判卷的生成器"，一次性投入换无限局与可测性。**

成本一页纸：

| 项 | 数字 |
| --- | --- |
| 一次性投入 | 6.5 人日（0.5 决策 + 3.0 P0 + 2.0 P1 + 1.0 P2） |
| 每月运维 | ¥0（纯静态站）；每次改规则由测试与预算门禁代跑回归 |
| 包体 | JS gzip 61.4 → ≈66 kB（+4.6 kB） |
| 生成耗时 | 12 位局 p95 ≈ 2 ms（只发生在开局/续玩一次） |
| 前置依赖 | UX 评审 P0 归因闭环（产品规格 §0 #6）——不满足则本方案顺延 |

---

## 1. 业务约束与已核对事实

### 1.1 硬约束

| 约束 | 来源 | 对方案的影响 |
| --- | --- | --- |
| 无后端、无数据库、纯静态托管（GitHub Pages） | `README` / `.github/workflows/deploy.yml` | 随机源只能本地；种子必须随存档走 |
| 运行时依赖只有 react / react-dom | `package.json` | RNG、生成器、校验器全部手写，不引 seedrandom / fast-check |
| 构建门禁 = `tsc --noEmit && vite build && postbuild` | `package.json` scripts.build | 新代码必须过 strict + noUnusedLocals；测试需单独约定 tsconfig 边界 |
| 现网已有 v2 存档与最高分 | `src/game/storage.ts:4-5` | 迁移必须保进度与最高分，不能"清档升级" |
| 现网已有 10 场景 / 104 断言的 CDP 验收脚本 | `scripts/verify-next-version.mjs` | 随机化直接打穿脚本里的常量断言，改造工作量已计入 |
| 单人前端（本方案按 1 名高级 FE 估算） | 项目现状 | 不选需要长期专人维护的机制；生成器必须一个人能读完 |

### 1.2 已核对的代码事实（方案前提，不是猜测）

| 事实 | 位置 | 对方案的影响 |
| --- | --- | --- |
| 访客是单一全局数组，共 10 位 | `src/data/visitors.ts:7-232` | 必须变成"每局一份"的运行时数据 |
| 局内访客取全局数组下标 | `src/hooks/useGame.ts:100,184` | reducer 必须持有 `run` |
| `total` 取自全局数组长度 | `src/hooks/useGame.ts:185` | 多关卡下必然错，必须随局走 |
| 存档校验用全局长度做上界 | `src/game/storage.ts:101,114-116` | v3 校验必须换成"本局 total" |
| 首页 `hasSave` 写死 `< 10` | `src/App.tsx:14,21` | 12 人局从第 11 位起显示"无存档" |
| 结算页从全局数组 `find` 访客 | `src/screens/ResultScreen.tsx:13,88` | 随机局查不到名字，流水退化成编号 |
| 规则广播按全局 `atIndex` 匹配 | `src/hooks/useGame.ts:55` + `src/data/rules.ts:56-72` | 广播时机必须来自本局蓝图 |
| 规则抽屉 "NEW" 标识写死索引 3 / 8 | `src/components/RuleDrawer.tsx:34` | 与蓝图脱钩 |
| 开放区是静态 `openFrom/openUntil` 区间 | `src/data/regions.ts:23-29` | 多关卡需要"每局时间线"，注册表只留静态事实 |
| `DAY 01` 写死在状态栏与首页 | `src/components/StatusBar.tsx:20`、`src/screens/HomeScreen.tsx:28` | 多天必须动态 |
| "十位访客"写死在文案与教学 | `src/screens/HomeScreen.tsx:32`、`src/components/TutorialSheet.tsx:12` | 玩家会数错 |
| 结局文案写死 V-007 / V-010 | `src/game/engine.ts:84,89` | 随机局可能没有这两个编号，必须数据化 |
| 验收脚本锁死 v2 key、10 条记录、3/6/8 广播 | `scripts/verify-next-version.mjs:32,100-101,132-133,159,165` | 必须参数化，否则 CI 必红 |
| 评分单源：表 + `resolveReview` + `gradeOf(score,total)` | `src/game/engine.ts:4-15,25-51,59-71` | **签名不变**；`total` 已是入参，多关卡天然支持 |
| 护照派生只读可见字段（禁读 correct/signals） | `src/data/passport.ts:26-42` | 生成器必须给稳定的 `avatarSeed`，否则护照号/章数会抖 |
| CI 只有 build，没有测试步骤 | `.github/workflows/deploy.yml:24,26,31` | 本方案顺带把 `npm test` 接进门禁 |
| 现产物 186.09 kB / gzip 61.38 kB | `PROJECT_STATUS.md` §12.2 | 包体预算基线 |
| `tsconfig` 允许带 `.ts` 扩展名导入 | `tsconfig.json:9` | 零依赖跑 TS 测试的前提 |
| 本机 Node v24.17.0，`node --experimental-strip-types --test` 实测通过；CI 在 Node 22（22.6+ 支持该开关） | 本次探针 + `deploy.yml:24` | 测试不需要 vitest |

### 1.3 为什么不能"把 VISITORS 换成随机数组"就完事

§1.2 里有 11 处硬编码直接依赖"10 位固定访客"。只换数据源会出现四类线上事故：

1. 存档恢复越界（`index > total`）→ 白屏或空访客；
2. 首页认为没存档 → 玩家进度"消失"；
3. 结算流水查不到访客 → 审计日志退化成编号列表；
4. 验收脚本全红 → 分不清真回归还是脚本过期。

本次真正的工作量是**把"局"提升为一等公民**，生成器只是其中一块。

### 1.4 与产品规格（`docs/design/levels-random.md`）的对齐

两份文档不能各说各话，先把口径钉死：

| 议题 | 产品规格主张 | 本方案 | 定论 | 谁决定 |
| --- | --- | --- | --- | --- |
| 关卡规模 | 3 天 × 8/10/12 = 30 位 | 原建议 5 天 × 70 位 | **采纳产品**：3 天。D04/D05 蓝图预留在 `levels.ts`，不排期（每天 +0.4 配置 +0.4 卡池） | 产品（范围） |
| 特殊事件 / 冲突 | 全部手工卡池 | 原建议模板化 | **采纳产品**：6 张手工卡，按 seed 从池中抽取并注入固定槽位；生成器只负责普通/干扰/异常/需开档 | 产品（叙事） |
| 存档结构 | 卡片快照，不只存种子 | 原建议 seed + 版本号重放 | **改主张，采纳产品**：文案改版后重放 drift 是真 bug，而 20 KB 快照在 5 MB 配额里不痛；版本号降级为遥测字段 | CTO（机制，我改） |
| 配额方式 | 先定配额再洗牌，随机只填坑 | 同样是 quota-then-plan | 一致 | — |
| 事件时点 | 由每日蓝图钉死，不随机 | 原设计允许槽位散布 | **采纳产品**：时点固定，窗口内**内容**随机。理由：随机时点 = 玩家被没见过的规则判错 | 产品（公平性） |

保留的分歧（不进本次范围，登记为待评估）：产品主张"随机化必须在 UX P0 归因闭环之后上线"。我认同顺序，但要求把它写成**硬前置**而不是口头共识——见 §14 Phase 0 的 gate。

---

## 2. 双档方案（业务按成本选，我给价）

约束复述：目标 = 关卡更多且每局不同；截止 = 未定（建议 2 周内上线 P0）；预算 = 1 名高级 FE；不可动 = 无后端、零运行时依赖、旧存档不丢、评分口径不变。

| 维度 | A 档：快 | B 档：对（推荐，分三批上） |
| --- | --- | --- |
| 方案要点 | 单日随机局：8→12 位随机访客 + 种子存档，不做多天、不做校验器 | 3 天 30 位 + 生成模板/干扰项/手工卡注入 + 生成期校验器 + v3 迁移 + 测试体系 |
| 上线时间 | 2.5 人日 | 6.5 人日（P0 3.0 / P1 2.0 / P2 1.0，含 0.5 决策） |
| 一次性成本 | 2.5 人日 | 6.5 人日 |
| 每月运维成本 | ¥0，但每次改规则靠人肉回归随机局 | ¥0；测试与预算门禁替你回归 |
| 引入的技术债 | 利息：每加一天关卡手工扩模板；随机质量无度量；无解局没有兜底 | 利息：模板文案是一次性内容债（§16） |
| 失败模式 | 生成出无解/答案写死的题，玩家发现后口碑崩，且无校验器兜底 | 生成器复杂度上升 → 用校验器 + 降级 + 10000 局测试兜底 |
| 退出 / 迁移路径 | 后续补 B 档要再迁一次存档（v3→v4） | 生成器变更不影响存档（快照），坏版本只影响新局 |
| 玩家感知 | "每局不一样"，3 局后察觉模板重复 | 30 位 + 干扰项 + 卡池轮换，重复感推迟到 6–8 局 |

**推荐 B 档，按 P0→P1→P2 分批上线。** 在"旧存档不能丢 + 验收脚本必须继续可信"这两个约束下，A 档省的 4 人日会在第二次迭代连本带利还回去（存档再迁一次 + 脚本再改一次 + 随机质量返工）。

**需要业务拍板的点**（我给成本，你们选）：

1. 关卡规模：3 天 / 30 位（推荐，采纳产品）vs 5 天 / 70 位（+2 人日，且需新增 2 个卡池）；
2. 旧存档：保留为冻结日 D00 可续玩（推荐）vs 只保最高分（省 0.5 人日，会挨骂）；
3. seed 展示：结算页给出 `SHIFT SEED` 支持复现/分享（≈0 成本，推荐）vs 不展示（客服失去复现凭证）。

**我行使否决权的部分**（不参与成本讨论）：

- 存档迁移导致最高分或进行中进度丢失；
- 判定前把 `correct` / `explanation` 渲染进 DOM；
- 生成路径出现 `Math.random` / `Date.now` / 对象键序隐式随机；
- 为让测试变绿而放宽校验器、删断言或改验收脚本判定口径。

---

## 3. 目标架构

```
                 ┌──────────────────────────────┐
   seed + day ──▶│  generator.ts（纯函数，同步） │
                 │  1 蓝图 → 2 槽位骨架          │
                 │  3 模板/卡池 → 4 字段物化     │
                 │  5 线索渲染 → 6 答案推导      │
                 └───────┬──────────────┬───────┘
                         │              │
                   rules-eval.ts    validate.ts
                  （规则判卷 oracle）（14 条不变量）
                         │              │
                         └──────┬───────┘
                                ▼
                      GeneratedRun（不可变）
                                │
                     useGame reducer（唯一状态机）
                                │
                  engine.ts（评分单源，签名不变）
                                │
            UI：GameScreen / ResultScreen / RuleDrawer
```

三条架构原则：

1. **生成期与运行期分离**：`rules-eval` 只在生成与测试时跑；运行期评分只走 `engine.resolveReview`，不重复判卷，避免双源。
2. **纯函数 + 显式输入**：`generateRun(seed, dayId)` 不读 `localStorage`、不读时钟、不读全局可变状态。
3. **数据与逻辑分层不变**：`src/data` 只放静态事实（地区/服务/规则文本/模板/卡池/蓝图），`src/game` 放算法（rng / eval / generator / validate / zones / storage）。

新增与改动模块：

| 模块 | 类型 | 职责 | 预估行数 |
| --- | --- | --- | --- |
| `src/game/rng.ts` | 新增 | mulberry32 + FNV-1a + 命名流 + pick/shuffle/weighted | 90 |
| `src/game/rules-eval.ts` | 新增 | 7 条规则谓词 + 优先级 + `evaluateVisitor` | 170 |
| `src/game/generator.ts` | 新增 | 8 步流水线 + 子流重试 + 降级 | 240 |
| `src/game/validate.ts` | 新增 | 14 条不变量 | 170 |
| `src/game/zones.ts` | 新增 | 按本局事件求"某索引时某区是否开放" | 50 |
| `src/game/ending.ts` | 新增 | 由局内数据生成结局文案（接管 `engine.ts:84,89` 的硬编码） | 70 |
| `src/data/templates.ts` | 新增 | 14 个生成模板 | 260 |
| `src/data/cards.ts` | 新增 | 6 张手工卡（特殊 3 / 冲突 3）+ 注入规则 | 180 |
| `src/data/levels.ts` | 新增 | 每日蓝图（配额/槽位/事件/规则引入） | 110 |
| `src/data/balance.ts` | 新增 | 难度权重、阈值、重试预算常量 | 60 |
| `src/data/legacy/visitors-d00.ts` | 迁移 | 现 10 位固定访客（冻结日 D00） | 230（搬移） |
| `src/types/game.ts` | 改动 | `templateId/day/index/requiresInspect/fingerprint`、`GeneratedRun`、`DayBlueprint`、`GameEvent` | +70 |

---

## 4. 随机源：seeded RNG 契约

### 4.1 选型

| 候选 | 结论 | 理由 |
| --- | --- | --- |
| `Math.random` | 否决 | 不可复现，同 seed 同局做不到，测试无从断言 |
| `crypto.getRandomValues` 当流 | 否决（仅用于取新局种子） | 不可复现；跨端一致性无保证 |
| `seedrandom` 等库 | 否决 | 违反零运行时依赖 |
| **mulberry32（32 位状态）** | **采纳** | 20 行可读、纯整数、跨引擎一致、周期 2³²，游戏级足够 |
| xoshiro128** | 备选 | 质量更好但更重；留给"可验证公平"需求出现时 |

派生用 FNV-1a 32 位：把"标签 + seed + 版本"压成子流种子。

### 4.2 命名流：让"改一段代码"不重排整局

```
master         = hash32(`ai-please|v${GEN_VERSION}|${dayId}|${seed}`)
events         = mulberry32(hash32(`${master}|events`))
slot[i]        = mulberry32(hash32(`${master}|slot:${i}`))
slot[i].try[k] = mulberry32(hash32(`${master}|slot:${i}|try:${k}`))
cardPool       = mulberry32(hash32(`${master}|cards`))
prose          = mulberry32(hash32(`${master}|prose`))
run.try[k]     = mulberry32(hash32(`${master}|run|try:${k}`))
```

关键点：**重试走槽位专属子流**。否则"第 7 位重试一次"会让第 8 位之后全部换人，玩家报 bug 时无法复现，测试快照天天变。这是随机生成器最容易踩的坑，P0 就定死。

### 4.3 确定性契约

同局成立条件（任一变化即视为不同局）：

1. 相同 `seed`（uint32）、`dayId`；
2. 相同静态数据（地区表 / 服务表 / 模板表 / 卡池 / `balance.ts` 常量）；
3. 相同生成器代码。

因为存档是快照（§10），**生成器代码变化不会破坏进行中的局**；版本号只用于 QA 复现与遥测。禁止清单（CI 用 grep 测试守）：生成路径出现 `Math.random` / `Date.now` / `new Date` / `performance.now` / `crypto`；用 `sort` 洗牌；依赖 `Object.keys` 顺序；浮点累加做概率（只在末尾做一次 `u32 / 2^32 < p`）。

### 4.4 冻结测试向量

P0 当天把 `(seed=1, version=1, day=D01)` 的前 8 个 `u32` 输出、以及整局 fingerprint 哈希写进 `tests/rng.vectors.test.ts` 与 `tests/generator.snapshot.test.ts`。以后谁改 RNG 或流水线，测试会红，逼迫他二选一：改回，或 bump 版本并说明影响。

---

## 5. 生成流水线（8 步，每步可单独测）

输入 `{ seed, dayId }`；输出 `GeneratedRun`（`visitors / rules / updates / events / zones / total`）。

| # | 步骤 | 随机流 | 做什么 | 失败处理 |
| --- | --- | --- | --- | --- |
| 1 | 蓝图装载 | 无 | 读 `DayBlueprint`：访客数、tier 配额、固定槽位（规则引入/名单变更/卡位）、难度目标 | 蓝图非法 → 抛 `GenerationError`（开发期即暴露） |
| 2 | 槽位骨架 | `slot[i]` | 按配额把 tier 填进非保留槽；保留槽由蓝图钉死；规则引入后的第一位留安全位 | 冲突 → 该位降为 distractor，记录 `adjusted` |
| 3 | 模板/卡池 | `slot[i]` / `cardPool` | 生成槽在"tier 匹配 + 依赖规则已生效 + 依赖地区当时开放"的候选里加权选 1，最近 6 位不重复；卡槽从对应卡池抽 1 张，本轮不重复 | 候选为空 → tier 降级（conflict→anomaly→normal） |
| 4 | 字段物化 | `slot[i]` | 生成地区/时区/语言/账号地区/服务/理由/设备/提交时间；违规模板只污染一个字段，其余自洽；卡池卡字段原样注入（时间/编号按槽位改写） | 字段冲突 → 重试（≤8 次） |
| 5 | 线索渲染 | `prose` | 由结构化事实（字段/观测值/期望值）渲染 `signals` 与 `hiddenClues`；**模板没有自由文案权**（`reason` 除外） | 命中禁词 → 拒绝渲染（开发期抛错） |
| 6 | 答案推导 | 不耗随机 | `evaluateVisitor(visitor, ctx)` 得 `correct / ruleRefs / explanation`；与槽位意图不符则重试 | 重试；连续 8 次 → 该 tier 保底模板 |
| 7 | 单局校验 | 不耗随机 | `validateRun()` 跑 14 条不变量（§7） | 有 problem → 整局重试（`run.try[k]`，≤4 次） |
| 8 | 兜底 | 不耗随机 | 仍失败 → 抛错，UI 提示"本局生成失败，已为你换一局"，`seed+1` 自动重开一次 | 连续两局失败 → 进 D00 冻结局（永不失败） |

预算与阈值（写进 `balance.ts`，测试断言）：

| 指标 | 目标 | 硬上限 |
| --- | --- | --- |
| 单槽重试 | p95 ≤ 2 次 | 8 次 |
| 单槽降级率 | < 0.5% | 2% |
| 整局重试率 | < 0.2% | 1% |
| 生成耗时（12 位） | p95 ≤ 2 ms | 16 ms（一帧） |

---

## 6. 内容注入：模板、卡池、干扰项、冲突、事件

### 6.1 生成模板（14 个，只负责普通/干扰/异常/需开档）

模板只声明：tier、决定规则、依赖（规则/地区）、字段污染方式、线索事实。**不声明 `correct`。**

| ID | tier | 决定规则 | 可见线索 | INSPECT 线索 | 期望判定 |
| --- | --- | --- | --- | --- | --- |
| `N-CLEAN` | normal | — | 无 | 账号历史正常 | APPROVE |
| `D-TZ-ODD` | distractor | — | 非整点时区（如 UTC+05:45），与注册表一致 | 出口节点正常 | APPROVE |
| `D-LANG-SUBTAG` | distractor | — | 语言带地区子标签（如 en-GB），与注册表一致 | 标签来源正常 | APPROVE |
| `D-DEVICE-LOOKALIKE` | distractor | — | 设备号 `BL-141`，黑名单是 `BL-14` | 指纹未命中 | APPROVE |
| `D-REASON-VERBOSE` | distractor | — | 理由冗长、含服务别名/全角字符，用途一致 | 无异常 | APPROVE |
| `D-ACCOUNT-NEW` | distractor | — | 注册 3 天，规则未设门槛 | 注册信息完整 | APPROVE |
| `A-ZONE` | anomaly | R01 | 该区此刻不在开放区 | — | DENY |
| `A-TZ` | anomaly | R02 | 时区与 IP 区标准时区相差 N 小时 | — | DENY |
| `A-ACCOUNT` | anomaly | R03 | 账号地区 ≠ IP 地区 | — | DENY |
| `A-LANG` | anomaly | R04 | 语言 ≠ 账号区注册语言 | — | DENY |
| `A-INTENT` | anomaly | R05 | 理由与申请服务用途不符 | — | DENY |
| `I-BLACKLIST` | inspect | R06 | `DEVICE_UNVERIFIED`（warn） | 设备命中黑名单 | DENY |
| `I-TIMESTAMP` | inspect | R06 | `SUBMIT_UNVERIFIED`（warn） | 账号创建晚于提交 | DENY |
| `I-CLEAN-CONFIRM` | inspect | — | `DEVICE_UNVERIFIED`（warn） | 指纹干净、时间线正常 | APPROVE |

覆盖度：R01–R06 每条 ≥1 个模板决定；5 个 tier 全含（special/conflict 由卡池负责）。

### 6.2 手工卡池（6 张，只负责特殊事件与规则冲突）

手工卡是完整访客数据 + 一段人工文案，**只能出现在蓝图钉死的卡槽**，按 seed 从池中抽，同一局不重复。字段（时间、编号、`avatarSeed`）由槽位改写，判定仍由 `evaluateVisitor` 复核——人工卡的 `correct` 也必须由 oracle 算出，不允许手写。

| ID | tier | 冲突/豁免 | 卡片事实 | 期望判定 | 出现日 |
| --- | --- | --- | --- | --- | --- |
| `S-MAINT-UND` | special | R04 豁免 | 区服维护导致语言字段为空，同批 214 份 | APPROVE | D01–D03 |
| `S-AMNESTY` | special | R01 豁免 | 该区处于特赦窗口（广播可见） | APPROVE | D02–D03 |
| `S-FALSE-POSITIVE` | special | R06 豁免 | 黑名单条目已被公告撤销 | APPROVE | D03 |
| `C-OVERRIDE` | conflict | R01 vs R07 | 该区关闭；持 EX-07 豁免编号 | APPROVE | D03 |
| `C-AMNESTY-BLOCKED` | conflict | 特赦 vs R06 | 该区特赦；设备命中黑名单 | DENY | D03 |
| `C-EXEMPT-EXPIRED` | conflict | R07 vs R01 | 豁免令已过期，编号仍有效 | DENY | D03 |

两张"覆盖失败"的卡是故意的：只教"有冲突就放行"，玩家会形成错误的启发式。

### 6.3 干扰项的三条纪律（全部进校验器）

1. **无信号**：`signals: []`。否则玩家学成"琥珀色 = 拒"，把推理降级成看图。
2. **可在字段层发现**：至少一个字段"看着不对"（时区/设备号/语言/账号年龄），且能用规则抽屉里的注册表**证伪**。
3. **不改变判定**：oracle 必须给 APPROVE 且无决定规则。

干扰项是"随机化之后仍然公平"的关键：没有它，3 局就背完模板；只有它没有规则对照，玩家会骂"耍人"。所以注册表要同步扩容（非整点时区必须真的写进 `REGIONS`）。

### 6.4 冲突题：优先级只能写在规则正文

现状缺陷（`src/data/visitors.ts:225-228` 的 V-010 线索直接写"R07 优先级高于 R01"）等于把答案印在题面。新规则：

- 优先级声明只在 `RULES` 正文（R07 body 已含"与 R01 冲突时以本条为准"）；
- 线索只给事实：该区不在开放区、持有豁免编号 EX-07、豁免令由本级指挥部签发；
- 校验器禁止线索出现结论词（I3）；
- 冲突卡必须恰有 2 条相反结论的规则，且其中一条在正文声明了优先级；否则判 `AMBIGUOUS`，拒绝出题。

### 6.5 特殊事件（时点钉死，内容受控）

`GameEvent` 统一建模；所有事件都有广播，沿用现有 ACK 锁（未确认前动作按钮禁用，`scripts/verify-next-version.mjs:135` 已在守）：

| 事件 | 广播 | 对生成的约束 |
| --- | --- | --- |
| `ruleIntro` | "R06 已上线" | 该索引前不得出现由 R06 决定的访客；之后 3 位内至少 1 位由它决定 |
| `zoneChange` | "TZ-07 移出 / SG-03 加入" | 变更前该区访客只能是 normal/distractor；变更后 2 位内至少 1 位 A-ZONE |
| `amnesty` | "BX-12 特赦窗口 3 位" | 窗口内 BX-12 访客不得由 R01 决定；窗口结束自动失效 |
| `systemIncident` | "区服维护，语言字段可能为空" | 受影响访客必须在广播之后；`und` 只允许出现在窗口内 |
| `blacklistRevoked` | "BL-19 条目撤销" | 只影响 `S-FALSE-POSITIVE`；公告必须早于该卡 |

硬约束：事件索引唯一、间隔 ≥3、总数 ≤ `ceil(total/4)`；任何改变判定依据的事件，其广播索引必须严格小于受影响访客索引——否则就是"事后改规则"，玩家必炸。

### 6.6 配额与节奏

| 天 | 总数 | N | D | A | I | S | C | 难度目标 | 蓝图事件（固定槽位） |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | 8 | 3 | 1 | 2 | 1 | 1 | 0 | 0.8 | R06@4 |
| D02 | 10 | 3 | 2 | 3 | 1 | 1 | 0 | 1.1 | R06@3 · 名单变更@7 |
| D03 | 12 | 3 | 2 | 4 | 1 | 1 | 1 | 1.4 | R06@3 · 名单变更@6 · 特赦@5（窗口 3）· R07@8 |

（N=normal，D=distractor，A=anomaly，I=inspect，S=special，C=conflict。规则集三天保持 7 条：随机化不跟"加规则"绑在一起，避免两件事同时改、出事分不清原因。D04/D05 蓝图预留：14/16 位，各 +0.4 配置 +0.4 卡池。）

难度预算：权重 N 0.2 / D 0.6 / A 1.0 / I 1.5 / S 2.0 / C 2.5；每 5 位一个 block，block 均值抖动 ±0.6，全天均值在目标 ±10%。防的是"连续 3 个冲突卡"这类劝退局。

反重复：同 templateId 最近 6 位不重复；同 `serviceId` 连续 2 位不重复；同地区连续 2 位不重复（除非该区刚发生事件）。

---

## 7. 可解性与"答案不被写死"的保证

核心机制：**生成期规则求值器（oracle）**。生成器先造数据，再由 `evaluateVisitor` 判卷得 `correct`；与槽位意图不符就重试/降级。于是"线索说 A、答案说 B"在结构上不可能——答案是算出来的，不是抄的。手工卡也走同一条复核，人工只写事实不写结论。

`evaluateVisitor` 返回形状（签名级）：

```
Evaluation = {
  verdict: 'APPROVE' | 'DENY' | 'AMBIGUOUS';
  findings: Finding[];        // ruleCode / kind: violation|exemption / field / observed / expected
  deciding: ruleCode | null;  // 唯一决定结论的规则
  requiresInspect: boolean;   // 结论是否依赖开档后的事实
  reason: string;             // 由 findings 拼出的解释（写入 explanation）
}
```

判定语义（顺序固定，写进测试）：

1. 收集 hard 规则违规（R01–R06）与豁免（R07、特赦、维护事故、黑名单撤销）；
2. 豁免按声明优先级覆盖指定规则；未覆盖的违规 → DENY；
3. 无违规 → APPROVE；
4. 两条不可比较的违规、或两个互相否定的豁免 → `AMBIGUOUS`（拒绝出题，绝不发局）。

### 14 条不变量

| 编号 | 不变量 | 检查点 | 违反时 |
| --- | --- | --- | --- |
| I1 | 同 `(seed, day)` 生成的 run 深度相等 | 生成器测试 + 快照 | 测试红，禁止合并 |
| I2 | 每位访客结论唯一（非 AMBIGUOUS）且等于 `visitor.correct`（含手工卡） | 生成期 + 测试 | 该槽重试，连续失败降级 |
| I3 | 判定前可见文本（signals / hiddenClues / reason / 字段）不含结论词：`放行/拒绝/驳回/通过/应批/APPROVE/DENY/正确/错误` | 生成期禁词表 + 测试 | 拒绝渲染（开发期抛错） |
| I4 | tier 与 findings 一致：normal/distractor 无违规；anomaly 恰 1 条；inspect 无可见违规；special 恰 1 条被豁免；conflict 恰 2 条相反结论 | 生成期 | 重试 |
| I5 | `requiresInspect` 的访客必须带 warn/alert 信号，且"只看可见字段"的结论与最终结论不同 | 生成期 + 测试 | 重试（修掉现网 V-005/V-009 无提示的公平性缺陷） |
| I6 | 每日 tier 配额精确命中；蓝图卡槽命中 | 生成期 | 整局重试 |
| I7 | 决定规则在该索引已生效；`ruleIntro` 前不得出现由它决定的访客；引入后 3 位内至少 1 位由它决定 | 生成期 | 重试 |
| I8 | 开放区状态与事件时间线一致；关闭区访客不得是 normal/distractor；名单变更后 2 位内出现 A-ZONE | 生成期 | 重试 |
| I9 | 局内 `fingerprint`（templateId/cardId + 5 个关键字段）唯一 | 生成期 | 重试 |
| I10 | `submittedAt` 格式 `DAY dd · HH:MM` 且严格递增 | 生成期 + 测试 | 重试 |
| I11 | 难度 block 均值单调（抖动 ≤0.6），全天均值在目标 ±10% | 生成期 | 重排槽位 |
| I12 | 判定前 DOM 不含 `correct` / `explanation` / 未开档的 `hiddenClues` | CDP 脚本 | 发布阻断 |
| I13 | APPROVE 占比 ∈ [0.45, 0.68] | 生成期 + 统计测试 | 重排 tier |
| I14 | `avatarSeed` 局内唯一（护照号/章数不撞） | 生成期 | 重掷 |

为什么 I5 值得单列：现网 V-005（设备黑名单）与 V-009（时间戳倒挂）的 `signals` 是空数组，玩家不花 ¥25 就完全没有提示，只能瞎猜。随机化会把这类"隐形开档题"批量生产出来，必须在生成期堵死。

---

## 8. 数据模型与类型扩展

### 8.1 类型草案（签名级）

```
Visitor += {
  templateId: string;      // 模板/卡 id，审计与测试用，不渲染
  day: string;             // 'D01'…'D03' | 'D00'
  index: number;           // 局内位置，杜绝"靠下标猜"
  requiresInspect: boolean;
  fingerprint: string;     // 去重
}

GeneratedRun = {
  seed: number;            // uint32，用于展示/复现/分享
  genVersion: number;      // 仅遥测与 QA 复现，不参与续玩判定
  day: string;
  total: number;
  visitors: Visitor[];
  rules: Rule[];           // since 已按本局蓝图重算
  updates: RuleUpdate[];   // 本局广播表（替代全局 RULE_UPDATES）
  events: GameEvent[];     // zoneChange / amnesty / incident / revoked
}

GameState += { run: GeneratedRun | null }        // 取代全局 VISITORS 读取
SavedRun(v3) = { v:3, seed, genVersion, day, total, run: GeneratedRun,
                 index, score, funds, inspected, inspectedCount, records,
                 seenUpdates, pendingUpdate, phase, lastRecord }
Meta(v3) = { schema:3, tutorialSeen, muted, bestScore, bestByDay, unlockedDay }
```

兼容策略：`correct` / `explanation` / `ruleRefs` 仍是 `Visitor` 必填（生成期写入，运行期只读），所以 `engine.resolveReview`、`FeedbackOverlay`、`ResultScreen` 的消费方式不变。新增字段全部必填——不用可选字段，避免"忘了赋值也能编译"的隐性漂移；现网 10 位搬进 `visitors-d00.ts` 时补齐。

### 8.2 派生约束

- `avatarSeed = hash32(fingerprint) % 1000`，局内去重；护照号/章数由它派生（`src/data/passport.ts:26-42` 不动）。
- `submittedAt` 由索引生成：`09:00 + 7min × index`，不读系统时钟。
- `name` / `alias` 来自虚构姓名池，与时区/语言做软匹配（避免"日语区出现斯瓦希里语姓名"的违和）。

---

## 9. 多关卡与"引擎单源评分不变"

### 9.1 不动的东西（承诺 + 验收项）

- `SCORE_TABLE` / `FUNDS_TABLE` / `START_FUNDS`（`engine.ts:4-17`）一个数都不改；
- `resolveReview` 签名与语义（`engine.ts:25-51`）不改；
- `gradeOf(score, total)`（`engine.ts:59-71`）不改——本就接收 `total`，多关卡天然支持；
- 判罚口径：判对 +100，误放行 −150，误拒绝 −100，开档 −¥25。

### 9.2 要动的东西

| 项 | 现状 | 改法 | 理由 |
| --- | --- | --- | --- |
| 结局文案 | `endingOf(mode)` 写死 V-007 / V-010（`engine.ts:84,89`） | 迁到 `src/game/ending.ts`：`endingOf(mode, summary)`，summary 含最高权重冲突卡编号/姓名、误放行次数、开档次数 | 随机局可能没有 V-010，文案不能指向不存在的访客 |
| 局内长度 | `total = VISITORS.length`（`useGame.ts:185`） | `total = state.run.total` | 12 人局不能被截成 10 |
| 规则广播 | 全局 `RULE_UPDATES` 按 `atIndex`（`useGame.ts:55`） | `run.updates` 按 `atIndex` | 每天广播时机不同 |
| 开放区 | 静态 `isOpen(code, index)`（`regions.ts:23-29`） | `isRegionOpen(run, code, index)`（扫描本局事件，≤8 条） | 需要"每局时间线" |
| 最高分 | 单一 `bestScore` | `bestByDay` + 全局最高（保留 `meta.bestScore` 做历史兼容） | 12 人局天然比 8 人局分高，单榜会被"刷长度"污染 |
| 天数标签 | 写死 `DAY 01` | `run.day` 映射 `D01→DAY 01` | 多天 |

### 9.3 多关卡 = 配置，不是分支

```
DayBlueprint = {
  id: 'D01' | 'D02' | 'D03';
  label: string;                  // 'DAY 01'
  visitorCount: number;
  tierQuota: Record<Tier, number>;
  difficultyTarget: number;
  reservedSlots: { index: number; kind: 'ruleIntro'|'zoneChange'|'card'|'amnesty'; ref?: string }[];
}
```

生成器只读蓝图，代码里没有 `if (day === 'D03')`。加第 4 天 = 20 行配置 + 0 行算法（模板与卡池复用），这是把"关卡更多"从开发成本变成编辑成本的关键。

---

## 10. 存档 v3：种子 + 快照

### 10.1 为什么改主张（我原来的方案是只存种子）

只存种子 = 续玩时重新生成。问题：生成器或文案任何一次改动，玩家进行中的局就会"换人/换答案"，且同一 seed 的 bug 无法复现。产品规格主张快照，我核对后同意：

| 维度 | 只存种子 | **种子 + 快照（采纳）** |
| --- | --- | --- |
| 存档体积 | 1–3 KB | 12–20 KB（12 位局实测估算），5 MB 配额里不痛 |
| 内容改版后续玩 | 会 drift，最伤信任 | 不变，玩家看到的还是那一局 |
| 生成器版本纪律 | 必须 bump + 丢弃老局 | 不需要，版本号降级为遥测 |
| 复现/分享 | 强 | 同样强（seed 仍存，可重新生成） |
| 作弊面 | 无 | 快照可被手改 → 用 I2 一致性校验兜（§10.3） |

结论：快照换掉了整类"重放 drift"缺陷，代价是一次 JSON 序列化（<0.5 ms）。这是本次方案里唯一一处我推翻自己初稿的地方。

### 10.2 键与结构

| 键 | 变化 |
| --- | --- |
| `ai-please:run:v3` | 新增；种子 + 整局快照 + 进度（≈12–20 KB） |
| `ai-please:meta:v3` | 新增；`schema / tutorialSeen / muted / bestScore / bestByDay / unlockedDay` |
| `ai-please:run:v2`、`ai-please:meta:v2` | 只读，**保留 14 天**（回滚保险），之后由清理版本删除 |

### 10.3 加载与迁移（纯函数，可测）

1. 读 v3：结构校验（`total ∈ [6,24]`、`index ∈ [0,total]`、`records.length ≤ total`、`phase` 合法、`run.visitors.length === total`）→ 逐条校验 record 的 visitor 存在且 `record.correct === visitor.correct`（防手改/防错位）→ 返回。
2. v3 不存在或损坏 → 读 v2：按现有规则校验（上界 10）→ 映射为 `{ v:3, seed:0, genVersion:0, day:'D00', total:10, run: { visitors: D00 十位 }, ...原字段 }` → 写 v3，**不删 v2**（保留期）。
3. 都不行 → `null`，沿用现有失败上报语义（`reportStorageFailure('read', ...)`，`storage.ts:16-29` 不变）。
4. 快照上的 `validateRun` 只做**告警式**校验：内容改版后老局可能不再满足新不变量，但它在创建时是合法的，不能因此丢档。硬校验只针对结构与一致性（上面第 1 条）。

### 10.4 冻结日 D00

现网 10 位固定访客原样搬进 `src/data/legacy/visitors-d00.ts`，`day=D00` 时生成器**直接返回该数组**（不走流水线）。收益：v2 存档原地续玩、分数一字不差；CDP 脚本可继续用 `?day=D00&seed=0` 跑原语义；出题连续失败时永远有兜底局。代价：仓库多 230 行冻结数据 + 一个分支——**有意欠的债**，还债触发见 §16。

### 10.5 回滚与降级

| 场景 | 行为 |
| --- | --- |
| 新版本有 bug，回滚部署 | v3 已写、v2 未删，旧版本读 v2 继续可用（保留期的意义）。因此迁移时 v2 原样留档、不再更新 |
| 生成器改版 | 老局走快照，不受影响；新局用新代码。无需丢弃任何存档 |
| localStorage 写失败 | 沿用现有 `reportStorageFailure('write')` 与 UI 提示（`App.tsx:30-34`），不新增失败路径 |
| 存储被手改 | §10.3 第 1 条的一致性校验判为损坏 → 丢 run 保 meta，不白屏 |
| 体积超限（极端：浏览器配额满） | 捕获写异常 → 提示"存档空间不足"；快照是最大风险点，故设 20 KB 预算并在测试中断言 |

---

## 11. UI 适配清单（文件级）

| 文件 | 改动 | 不改的后果 |
| --- | --- | --- |
| `src/App.tsx` | `hasSave` 改为 `run.index < run.total`；`savedIndex` 从 run 取 | 12 人局第 11 位起显示"无存档" |
| `src/hooks/useGame.ts` | reducer 持有 `run`；`MOVE` 读 `state.run.visitors[index]`；`START` 接 `{ seed, day }`；`RESUME` 用快照恢复并做一致性校验；落盘带 v3 字段 | 读全局数组 → 越界/错人 |
| `src/screens/HomeScreen.tsx` | "十位访客"→ `{total} 位访客`；天数选择（未解锁置灰）；显示当日最高分 | 文案与事实不符 |
| `src/screens/ResultScreen.tsx` | `total` 从 state 取；流水从 `state.run.visitors` 查名字；显示 `SHIFT SEED`；结局改调 `ending.ts` | 流水查不到人、结局指向不存在的 V-010 |
| `src/components/StatusBar.tsx` | `DAY` 取 `run.day`；进度点 >20 时切"分段条 + 计数"（`.pip-track` 是 `flex:1`，12 格很宽松） | 天数恒为 DAY 01 |
| `src/components/RuleDrawer.tsx` | 规则/开放区状态来自 `run`；`freshCode` 由"本局最近一次已确认 ruleIntro"推导，不写死 3/8 | 随机局标错 NEW |
| `src/components/TutorialSheet.tsx` | "十位访客后进入复盘"→"本班次结束后进入复盘" | 教学与现实不符 |
| `src/components/FeedbackOverlay.tsx` | special/conflict 时追加一行"本题考点"（P2 可选） | 玩家学不到冲突规则 |
| `src/styles/global.css` | 天数选择样式；`.pip-track.compact`（>20 格） | 后续扩天时挤压 |

---

## 12. 包体与性能影响

### 12.1 包体预算（基线 186.09 kB / gzip 61.38 kB）

| 模块 | raw 预估 | gzip 预估 |
| --- | --- | --- |
| `rng.ts` | 1.2 kB | 0.5 kB |
| `rules-eval.ts` | 3.5 kB | 1.2 kB |
| `generator.ts` | 4.5 kB | 1.5 kB |
| `validate.ts` | 2.4 kB | 0.9 kB |
| `templates.ts` + `cards.ts` + `levels.ts` + `balance.ts` | 7.5 kB | 2.3 kB |
| `zones.ts` + `ending.ts` | 1.8 kB | 0.6 kB |
| 搬走固定 10 位（D00 分支） | −5.0 kB | −1.6 kB |
| **净增** | **≈ +16 kB** | **≈ +5.4 kB** |

JS gzip 61.4 → ≈66.8 kB。**不做代码分割**：为 16 kB 加一次额外请求，在静态离线站上是负收益（gzip 后只有 5 kB）。门禁：`dist/assets/*.js` gzip ≤ 70 kB，总产物 ≤ 260 kB。

### 12.2 运行性能

- 生成只在 `START` / `RESUME` 发生一次：12 位 × 平均 1.3 次尝试 ≈ 1.5 万次整数运算，目标 p95 ≤ 2 ms（实测见 §13.2 的 `perf` 套件）；
- 不进 render：`run` 存 reducer state，`visitor = run.visitors[index]`；
- 存档每次状态变更写一次，payload ~12–20 KB → 比 v2 多约 10 倍。风险：低端机 localStorage 同步写有 1–3 ms 抖动。缓解：records 只存必要字段（不复存 `hiddenClues`）；实测超过 5 ms 再改"进度变更节流 300ms"（本方案不做，先测）。

### 12.3 测量方法

- 包体：`npm run build` 输出 + `scripts/check-budget.mjs`（解析 dist，超预算 exit 1）；
- 生成耗时：`tests/perf.test.ts` 跑 1000 局取 p50/p95，断言 p95 ≤ 16 ms（CI 机器慢，硬上限；目标值只记录趋势）；
- 跨引擎一致：CDP 里对 `seed=42, day=D01` 取 `JSON.stringify(run)` 哈希，与 Node 侧快照比对。

---

## 13. 测试策略

### 13.1 跑法：零依赖，Node 内建

```
npm test  →  node --experimental-strip-types --test tests/
```

已实测（本机 Node v24.17.0 通过），CI 的 Node 22 自 22.6 起支持该开关。约束：只用可擦除语法（无 enum / namespace / 参数属性）；相对导入带 `.ts`（`tsconfig.json:9` 已允许）；类型导入用 `import type`（现有代码已是此风格）。

| 备选 | 成本 | 问题 |
| --- | --- | --- |
| vitest | +1 devDep + 配置 | 与零重型依赖文化冲突，收益仅 watch/覆盖率 |
| 纯 JS 断言 + 手写复刻生成器 | 无 | 测的不是跑的那份代码，最坏的一种测试 |

类型检查：`tests/` 不进 `tsconfig.json` 的 `include`（否则要为 `node:test` 装 `@types/node`）。这是明确接受的债（§16 #2）。

### 13.2 套件与断言

| 套件 | 断言 | 数量级 |
| --- | --- | --- |
| `rng.vectors.test.ts` | 冻结向量逐位相等；`shuffle` 保多重集且确定；`fork` 标签不同则流不同 | ~15 |
| `generator.snapshot.test.ts` | `seed=1/D01` 整局指纹哈希固定；两次生成深度相等 | ~8 |
| `generator.invariants.test.ts` | 3 天 × 3333 seed ≈ 10000 局，逐局跑 I1–I14 | 10000 × 14 |
| `generator.solvability.test.ts` | 每访客 `evaluate === correct`；无 AMBIGUOUS；每模板/卡至少用一次；I4 结构成立 | ~10 + 10000 循环 |
| `distribution.test.ts` | 配额精确；模板与卡池覆盖 ≥1；地区覆盖 ≥95%；APPROVE 占比 ∈[0.45,0.68]；`nextU32 % 6` 分桶 60000 次在 9000–11000；2000 seed 指纹唯一率 ≥99.9% | ~12 |
| `evaluator.rules.test.ts` | 7 条规则单测；R07 覆盖 R01；特赦不覆盖 R06；`und` 豁免；时间戳倒挂；黑名单撤销 | ~20 |
| `storage.v3.test.ts` | v3 读写；v2→v3 迁移保字段；幂等；v3 损坏回退 v2；`total` 越界拒绝；一致性校验抓篡改；失败上报语义 | ~18 |
| `legacy.d00.test.ts` | D00 输出与现 10 位逐字段相等（迁移与验收脚本的锚点） | ~3 |
| `perf.test.ts` | 1000 局 p95 ≤ 16 ms；单局序列化 ≤ 2 ms | 2 |

### 13.3 统计断言怎么写才不 flaky

- 测试自己的随机源是**固定 seed 集合**（`FOR_SEED_BASE..+N`），不用 `Math.random`；
- 只断言"确定性事实"（配额/覆盖/去重/一致性）与"宽区间统计"（占比 45–68%、分桶 9000–11000），不追 p 值精确到小数；
- 单次运行 < 8 s（10000 局 × 12 位纯整数运算）；
- 统计失败必须打印违规 seed 与槽位，一键复现。

### 13.4 验收脚本（CDP）v3 改造

现有耦合点：v2 key（`verify-next-version.mjs:32`）、10 条记录（`:100-101,159,165`）、3/6/8 广播（`:132-133`）。原则：**不削弱任何现有断言，只把常量换成"从存档/页面读来的事实"。**

| 现状 | 改成 |
| --- | --- |
| `records.length === 10` | `records.length === total`（total 从 run 读） |
| `[3,6,8]` 广播 | 从 `run.updates.map(atIndex)` 读；仍守"广播位锁按钮 + 刷新保持 + ACK 只记一次" |
| 新局内容不可预知 | 启动 URL 加 `?seed=20261024&day=D01`，与 Node 快照共用同一 seed，断言对象稳定 |
| `V-010` 重放检查 | 用 `run.visitors[index].code` 动态取当前编号 |
| 无 | 新增：同 seed 两局指纹哈希相同（确定性）；同 seed 不同 day 必不同（多样性）；DOM 不含 `explanation`（I12）；v3 快照续玩后指纹不变 |

---

## 14. 文件级实施计划

### Phase 0 · 决策与基线（0.5 人日）

| 项 | 动作 | 验收 / gate |
| --- | --- | --- |
| 前置 gate | UX 评审 P0 归因闭环（产品规格 §0 #6）已完成 | 未完成则本方案顺延，不并行开工 |
| 冻结向量 | 先落 `rng.ts` + 向量测试 | `npm test` 绿，向量值回填本文 §4.4 |
| 基线测量 | 记录当前 build 体积、10 局生成/序列化耗时 | 数字进 `PROJECT_STATUS.md` |
| 签字 | §2 三个拍板项 + §1.4 五项对齐 | 未签不进 Phase 1 |

### Phase 1 · P0：能随机、能存档、能验收（3.0 人日）

| 顺序 | 文件 | 动作 | 验收 |
| --- | --- | --- | --- |
| 1 | `src/game/rng.ts` | RNG + 命名流 | `rng.vectors.test.ts` 绿 |
| 2 | `src/game/rules-eval.ts` | 7 条规则谓词 + 优先级 + 唯一结论 | `evaluator.rules.test.ts` 绿（含 R07 覆盖 R01、特赦不覆盖 R06） |
| 3 | `src/data/templates.ts` | 14 个生成模板 | 模板结构自检测试绿 |
| 4 | `src/data/levels.ts` + `balance.ts` | D01 蓝图（8 位）+ 常量 | 配额测试绿 |
| 5 | `src/game/generator.ts` | 8 步流水线 + 子流重试 + 降级 | 快照绿；10000 局 I1–I14 绿 |
| 6 | `src/game/validate.ts` | 14 条不变量 | 注入坏模板 → 校验器必须抓到（反向测试） |
| 7 | `src/types/game.ts` | 类型扩展 + `GeneratedRun` | `tsc --noEmit` 绿 |
| 8 | `src/data/legacy/visitors-d00.ts` | 搬移现 10 位并补齐新字段 | `legacy.d00.test.ts` 逐字段相等 |
| 9 | `src/game/storage.ts` | v3 快照读写 + v2 迁移 + 保留期 | `storage.v3.test.ts` 绿 |
| 10 | `src/hooks/useGame.ts` | run 进 reducer；`START` 接种子；`RESUME` 走快照 | 手动：刷新续玩、完成结算、开新局 |
| 11 | `App.tsx` / `HomeScreen` / `ResultScreen` / `StatusBar` / `RuleDrawer` / `TutorialSheet` | 去掉 10 与 DAY 01 的硬编码 | CDP 全绿 |
| 12 | `scripts/verify-next-version.mjs` | 参数化 seed 与 total | 10 场景全绿，断言数不减少 |
| 13 | `.github/workflows/deploy.yml` | `npm ci` 后加 `npm test` | CI 红则阻断部署 |

Phase 1 结束状态：新局 = 随机 8 位；刷新可续；旧存档可续到 D00；验收脚本可信。

### Phase 2 · P1：3 天 + 卡池 + 分布测试（2.0 人日）

| 顺序 | 文件 | 动作 | 验收 |
| --- | --- | --- | --- |
| 1 | `src/data/cards.ts` | 6 张手工卡 + 卡槽注入 | 卡池覆盖测试：3 天内每卡至少出现 1 次 |
| 2 | `src/data/levels.ts` | D02/D03 蓝图（10/12 位、固定槽位、事件） | 每天配额与槽位测试绿 |
| 3 | `src/game/zones.ts` | 事件时间线求开放状态 | 名单变更前后判定一致性测试 |
| 4 | `HomeScreen` + `meta.unlockedDay` | 天数选择与解锁 | 手动走完 D01→D02→D03 |
| 5 | `src/game/ending.ts` | 结局数据化 | 随机 20 局结算无悬空 V-code |
| 6 | `tests/distribution.test.ts` | 统计断言 | 固定 seed 集连跑 20 次稳定 |
| 7 | `src/styles/global.css` | 天数选择、进度条压缩 | 390 / 320 两视口不溢出 |

### Phase 3 · P2：可分享与可调优（1.0 人日）

| 项 | 动作 | 验收 |
| --- | --- | --- |
| seed 展示/复现 | 结算页 `SHIFT SEED`；首页"重玩此 seed" | 输入 seed 复现同一局 |
| 平衡调参 | 用 10000 局统计报告调 `balance.ts` | 难度曲线与判定分布落在目标区间 |
| 文案二轮 | 抽样 20 局人工通读 | 无"机器味"重复句 |
| 文档 | `PROJECT_STATUS.md` 增补本轮证据 | 与 §18 对齐 |

**总计 6.5 人日。** 假设：1 名熟悉本仓库的高级 FE；不需要新视觉稿；地区/服务只在现有 8 区 5 服务内扩展。

---

## 15. 风险登记册

| # | 风险 | 概率 | 影响 | 触发信号 | 缓解 |
| --- | --- | --- | --- | --- | --- |
| 1 | 生成出无解/自相矛盾的题 | 中 | 高（口碑） | 校验器 problem 率 >0.1% | oracle 判卷 + I2/I4 + 降级 + 10000 局测试 |
| 2 | 线索把答案写死 | 中 | 高（玩法失效） | 禁词命中 / "看图就会" | 结构化事实渲染 + I3 + 20 局人工抽样 |
| 3 | 确定性漂移（改代码后老 seed 变局） | 中 | 低（有快照兜底） | 快照测试红 | 命名流 + 冻结向量；续玩不依赖重放 |
| 4 | 旧存档迁移丢进度 | 低 | 高（信任） | 迁移测试红 / 用户反馈 | D00 冻结 + 双读保留期 + 幂等 + 回滚演练 |
| 5 | 验收脚本与新局耦合导致 CI 假红 | 高 | 中（拖慢发布） | 断言失败但手工正常 | 参数化 seed（Phase 1 第 12 步），只读运行时事实 |
| 6 | 随机局"看着都一样" | 中 | 中（留存） | 20 局抽样重复感明显 | 反重复窗口 + 干扰项 + 姓名/理由池扩容 |
| 7 | 难度尖峰（连续冲突卡） | 中 | 中 | block 均值抖动超阈值 | I11 + 槽位重排 |
| 8 | 快照存档超配额/写入抖动 | 低 | 中 | 写异常 / 写入 >5 ms | 20 KB 预算断言；超 5 ms 再上节流 |
| 9 | 单人维护成本失控 | 中 | 中 | 改一条规则要动 5 个文件 | 规则正文/谓词/模板三处分离 + 测试锁；规则数上限 7 |
| 10 | 卡池被玩家背熟（6 张太少） | 中 | 中 | 2 局内认出同一张卡 | 每类池 ≥3 + 按 seed 轮换；D04 扩池时补到 5/类 |

---

## 16. 技术债台账（允许欠，不允许瞒）

| 债项 | 本金 | 利息 | 还债触发信号 | 责任人 |
| --- | --- | --- | --- | --- |
| D00 冻结局常驻 | 0.5 人日（删数组 + 删分支） | 7 kB 包体 + 两条代码路径 | 上线 2 个 release 且 v2 存档占比 <1% | FE |
| `tests/` 不进类型检查 | 0.5 人日（`@types/node` + `tsconfig.test.json`） | 测试里的类型错误只能靠运行时暴露 | 第一次因测试类型错导致 CI 假绿 | FE |
| 模板/卡片文案人工写 | 持续（每模板 ~15 分钟） | 句式重复的"机器味" | 抽样 20 局同句式 ≥5 次 | 内容 |
| 难度常量手工调 | 1 人日（自动平衡脚本） | 每次调参靠试玩 | 第 3 次手工调参 | FE |
| 求值器与规则正文双写 | 0（测试锁住） | 文案改了谓词没改 → 判定与文案不符 | 规则文案变更 PR 未同步改谓词 | FE + 评审 |
| CDP 脚本与固定局的历史耦合 | 1 人日（已计入 Phase 1） | 每次改玩法手工改断言 | 本方案 Phase 1 一并还清 | FE |

本期允许新增：文案债、难度常量债（均附触发条件）。**不批**无触发条件的"以后再说"。

---

## 17. ADR-001：生成期规则求值器作为答案 oracle

- 日期：2026-10-24 ｜ 决策人：CTO ｜ 状态：提议
- **当时的约束**：团队 1 人（熟悉 React/TS，未写过生成式系统）｜在招市场供给：无（不扩编）｜数据量：30 个访客位/版本，localStorage 单机｜预算：6.5 人日｜不可动：无后端、零运行时依赖、旧存档不丢
- **备选方案与淘汰理由**：
  1. 手写 30 位固定访客 —— 内容成本 6+ 人日且没有随机性，不满足需求；
  2. 模板 + 手写 `correct` —— 最快（2.5 人日），但答案与线索靠人肉对齐，一旦漂移就是无解题，且无法自动校验，淘汰；
  3. 模板 + 生成期求值器（本方案）—— 多 2 人日，换"答案可证明、可测试、可降级"；
  4. 构建期用 LLM 批量生成题目并固化 JSON —— 质量不可控、无法确定性复现、引入构建期外部依赖，淘汰；
  5. 运行时用 LLM 生成 —— 违背离线/无 API 约束，淘汰。
- **决定与已知代价**：采用 3。代价：规则语义在"文案"与"谓词"两处存在（测试锁）；生成器约 500 行需要一个人读懂；引入 `genVersion` 与冻结向量纪律。
- **复审触发条件**：模板 + 卡 > 30；生成 p95 > 16 ms；校验器拦截率 >1%；出现"判定与规则文案不一致"的玩家报告；团队扩到 ≥3 人可分工维护内容流水线。

---

## 18. 验收清单（DOD）

- [ ] `npm run build` 绿（tsc strict + vite + postbuild）
- [ ] `npm test` 绿，且 10000 局生成 0 例校验失败、0 例 AMBIGUOUS
- [ ] 同 `(seed, day)` 在 Node 与 Chrome 生成的 run 哈希一致
- [ ] v2 真实存档（迁移前手工导出）可续玩，进度/分数/最高分不变
- [ ] D00 局与现网 10 位逐字段一致
- [ ] CDP 脚本 v3 绿，断言数 ≥ 现网 104 条，未删任何安全/可达性断言
- [ ] D01–D03 均可通关；结算无悬空访客编号；结局不引用不存在的 V-code
- [ ] 390×844 与 320×568 下 12 人局不溢出、按钮可达
- [ ] JS gzip ≤ 70 kB；生成 p95 ≤ 16 ms；单局序列化 ≤ 2 ms
- [ ] 判定前 DOM 不含 `correct` / `explanation` / 未开档的 `hiddenClues`
- [ ] `PROJECT_STATUS.md` 附本轮证据（命令输出、截图、统计报告）

---

## 19. 需要业务拍板的三件事

| # | 决策 | 选项 | 成本差 | 我的建议 |
| --- | --- | --- | --- | --- |
| 1 | 关卡规模 | 3 天/30 位 vs 5 天/70 位 | +2 人日（含 2 个新卡池） | 先 3 天：第 4–5 天在没有新卡池前只是量增，收益低 |
| 2 | 旧存档 | 冻结日 D00 续玩 vs 只保最高分 | −0.5 人日 | D00：丢档的信任成本远高于半天工 |
| 3 | seed 展示 | 结算页展示 vs 不展示 | ≈0 | 展示：零成本传播点，且给 QA/客服一个复现凭证 |

签字后按 Phase 0→1 推进；P1/P2 不占排期，等 P0 上线后再确认。
