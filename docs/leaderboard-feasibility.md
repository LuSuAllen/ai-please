# 小红书小工具「排行榜内测」接入评估

> 评估对象：ai-please 0.2.0（候选）  
> 评估日期：2026-11-08  
> 代码基线：`feat/minitool-0.1.0` @ `c8beb1b`  
> 结论：**受限可做（Conditional GO）**；但“读取小红书账号身份”**不能做**。  
> 本文为只读评估，未修改任何代码。

---

## 0. 结论先行

### 0.1 一句话结论

平台确实在 2026-11-06 的在线文档中新增了排行榜 API（`submitScore` / `getRankList` / `getMyRank`），但它是**内测能力、尚未正式开放**，需要客户端 9.51+、上传时勾选「用户头像昵称授权」，并可能受容器白名单限制。它足以做“**平台公开榜内、按榜位/周期比较分数与昵称**”的轻量榜单（是否按小工具隔离见未验证 #11）；但**没有任何读取账号身份（uid/openid/头像/好友/关注列表）的 API**，所以原需求中的“读取小红书账号身份”应判定为**不能做**，只能退化为“平台在榜单返回值里给的昵称”。

### 0.2 需求逐项判定

| 需求 | 判定 | 依据 | 说明 |
| --- | --- | --- | --- |
| 读取小红书账号身份（uid/openid） | **不能做** | 在线文档没有用户信息 API；冻结基线 `js-api.md:30-36` 也无；`getLaunchOptions` 只给 `miniToolEnv.userDataPath` / `buildVersion`（`js-api.md:54-59`） | 没有稳定身份键，不能建用户档案、不能去重、不能做好友榜 |
| 读取昵称 | **受限可做** | `getRankList` 返回 `{rank, score, nickname}`；`nickname` 可为 `null` | 昵称是榜单返回值，不是账号资料接口；不得自行采集/存储 |
| 读取头像 | **不能做** | `getRankList` 契约只有 `nickname`，无 `avatar`；文档只要求勾选“头像昵称授权”，但未给头像字段 | 不要假设“授权了就有头像”；UI 用名次徽章即可 |
| 读取好友/关注列表并比较 | **不能做** | 无好友/关注列表读取 API；`followAuthor` / `getFollowStatus` 只能关注/查询“当前小工具作者”，不能读取用户的好友或关注列表 | 只能做全量公开榜，不能做“好友榜” |
| 跨用户排名（平台榜） | **受限可做** | 在线文档 §3.17；前 100 名列表；`getMyRank` 前 500 名；内测 + 授权 + 版本门控 | 可做“单关榜/周榜/总榜”；不能做自建后端榜 |
| 自建后端跨用户榜 | **不能做** | 页面禁用 `fetch` / `XMLHttpRequest` / WebSocket（§4.1/4.2）；云存储按“用户 × 小工具”隔离，不是公共榜（§3.16） | 没有自家服务端通道；不要试图绕过 CSP |
| 纯本地个人最佳 | **已具备** | `src/hooks/useGame.ts:235-252` 已写 `meta.bestScore` / `bestByDay` | 不需要排行榜也能保留；是平台不可用时的兜底 |

### 0.3 推荐决策

1. **做“平台排行榜”的可选增强，不做“账号身份读取”。**
2. 首版只做 **board 1–4 = D01–D04 的单关榜**，周期先开放 **周榜 / 总榜**；不做跨关卡总榜，不做日榜（避免“必须每天玩”的焦虑）。
3. **board 5 预留给未来的周赛/活动**，首版不用；因为跨关卡总分不可直接比较，硬做会制造不公平。
4. 入口放在**结算页**，失败不阻塞“再玩一次/返回首页”；首页只改文案，不把榜单做成主入口。
5. **P0 平台门禁先过，再写生产代码**：确认内测资格、授权勾选、白名单、真机 9.51+。门禁不过，最多保留本地最佳，不投入 UI。
6. 新分支**应该建**，但建议先把 0.1.0 合入 `main`，再从最新 `main` 开 `feat/minitool-leaderboard`。

---

## 1. 证据基线

### 1.1 冻结基线（本地）

`/Users/lusuallen/.dsh/skills/minitool-zip-builder/references/js-api.md` 是 2026-09-23 的本地快照。其 API 一览只有：

| API | 用途 | 最低版本 |
| --- | --- | --- |
| `postNote` | 打开笔记发布页 | — |
| `saveImageToPhotosAlbum` | 保存图片到相册 | — |
| `writeTempFile` | base64 写临时文件 | — |
| `getLaunchOptions` / `launchOptions` | 启动参数与环境信息 | — |
| `setStorage` / `getStorage` / `getStorageInfo` / `removeStorage` / `clearStorage` | 本地缓存 | 9.46 |
| 文件系统（`saveFile` 等） | 本地文件 | 9.49 |
| `interactionOpenApi` | 评论区草稿 | 9.49 |

关键约束：

- `js-api.md:3` 明确“实现在线文档优先，仅当远程文档无法获取时才以本文为契约参考”。
- `js-api.md:12` 明确“只调用本文列出的 API，不直接调用原生 bridge”。
- `js-api.md:75-76` 的 `readBuildVersion` 只读 `launchOptions.miniToolEnv.buildVersion`；`buildVersion` 末三位是编译序号（如 `9462004` → 9.46.2）。
- 基线中**没有**排行榜、排名、用户信息、头像、uid/openid、好友、关注列表、云存储、AI、分享、定位、振动、陀螺仪。

因此：**以冻结基线为准，排行榜不可用；以在线文档为准，排行榜是新增内测能力。** 两者不矛盾，是快照时间差。

### 1.2 在线文档差异（2026-11-06）

在线文档：<https://miniapp-sandbox.xiaohongshu.com/minitool/doc>（HTTP 200，页面标注最后更新 2026-11-06；本地抓取到 `/tmp/xhs-minitool-doc.html`，140,741 字节）。

| 能力 | 冻结基线 | 在线文档 | 判定 |
| --- | --- | --- | --- |
| `submitScore` | 无 | §3.2 列出，标注“客户端 9.51+，内测” | 新增，内测 |
| `getRankList` | 无 | 同上 | 新增，内测 |
| `getMyRank` | 无 | 同上 | 新增，内测 |
| 用户信息 / 头像 / uid | 无 | **仍无** | 不存在 |
| 云存储 | 无 | §3.16，9.51+，内测，按用户隔离 | 不能当公共榜后端 |
| 页面直连网络 | 禁止 | §4.1/4.2 继续禁止 `fetch` / XHR / WebSocket / 外链资源 | 不能自建后端 |

在线文档还新增了 AI 文本生成、关注作者、分享、窗口信息、定位、振动、陀螺仪等能力；这些不改变本结论：**没有用户身份读取 API**，`followAuthor` / `getFollowStatus` 也只针对“当前小工具作者”，不能读用户的好友或关注列表。

**“公开”要分两层说：**

- **文档公开**：任何人可以访问在线文档，看到 API 契约。
- **能力公开（GA）**：不是。文档明确写“内测能力，尚未正式开放”，并要求“请勿将其作为核心功能的唯一依赖”。
- **接入公开**：不是。需要上传时勾选「用户头像昵称授权」，未授权按 `errCode 1005` 失败；容器白名单还可能返回 `10003`。这两道门是否需要同时满足，文档没有给出组合矩阵，**未验证**。

### 1.3 排行榜契约（决定技术方案的关键点）

| 项 | 契约 | 对方案的含义 |
| --- | --- | --- |
| `board` | 整数 1–5，默认 1 | 榜位只有 1–5 五档；当前 4 关刚好用 1–4，board 5 必须预留 |
| `period` | `all` / `month` / `week` / `day`，默认 `all` | 非法值本地报 `10001`，请求不发出；客户端应先校验 |
| `submitScore` | `{board?, score:number}`；分数绝对值，不缩放不取整；范围 -1,000,000 ~ 1,000,000 | 当前单关分数在 -2,400 ~ 1,600，天然安全；未来改分要加范围守卫 |
| `submitScore` 返回 | `{score}` = **总榜历史最高分（已合并本次提交）** | 不要把它当“本次成绩”；它可能是历史最佳，不是本局分数 |
| `getRankList` | 返回 `{data:[{rank, score, nickname}]}`；固定前 100 名，降序；`limit` 不开放 | 只能展示前 100；第 101 名以后要靠 `getMyRank` 补 |
| `getMyRank` | `{status, rank, score}`；`EXACT`（前 500，rank 1–500）/ `OVER_LIMIT`（500 外，rank/score 为 null）/ `NO_SCORE`（已参与本期无成绩）/ `NOT_PARTICIPATING`（未参与） | UI 要能显示“500+”“本期未上榜”“未参与”，不能只处理 EXACT |
| 成绩保留 | 各周期只保留最好成绩；低分提交也成功 | 低分不会覆盖高分；UI 要写“榜单记录最好成绩” |
| 同分 | 先写入者靠前，名次唯一不并列 | 不要做“并列第 N”；按返回的 `rank` 展示 |
| 事务 | 一次提交在服务端事务内拆总/月/周/日四榜 | 一次提交，四个周期都可能更新；不需要分别提交 |
| 重置 | 北京时间 0 点；周榜周一、月榜每月 1 日；新一期不沿用上期 | UI 要写“北京时间重置”；不要假设本地时区 |
| 缓存未就绪 | `errCode 2002`；建议 500ms/1s/2s/4s 退避 | 不能把 2002 当空榜；`data: []` 才是真空榜 |
| 昵称缺失 | `nickname` 可为 `null` | 渲染必须兜底；不能显示 `null` |
| 限频 | 云存储/排行榜按“小工具 × 接口”默认 150 QPS；超限 `2009` | 当前调用量远低于上限，但仍要缓存/退避 |
| 隐私 | “昵称由平台填充并仅在返回值中出现，不得自行采集或存储用户小红书资料” | 昵称只能内存展示，不能写 localStorage/Storage/文件/日志 |
| 上传授权 | 使用 `submitScore` 必须勾选「用户头像昵称授权」；未勾选按 `1005` 失败 | 这是发布门槛，不是代码能绕过的 |

### 1.4 账号身份字段可得性

| 字段 | 能否拿到 | 来源 | 能否用于榜单 | 备注 |
| --- | --- | --- | --- | --- |
| `uid` / `openid` | **不能** | 无 API；`getLaunchOptions` 无身份字段 | 不能 | 不能做稳定用户键、不能跨榜识别同一人 |
| 昵称 | **受限** | `getRankList` 返回 `nickname` | 可以展示 | 可为 `null`；不得采集/存储；不能当唯一身份键 |
| 头像 | **不能** | 契约无 `avatar` | 不能 | “头像昵称授权”是授权项名称，不等于返回头像 |
| 好友/关注列表 | **不能** | 无 API | 不能 | 只能全量公开榜 |
| 当前用户排名 | **可以** | `getMyRank` | 可以展示 | 隐式“我”，不需要 uid |
| 当前用户本期最好分 | **可以** | `getMyRank.score`（EXACT 时） | 可以展示 | `NO_SCORE` / `OVER_LIMIT` 时为 null |

**结论：** 能做“平台榜单内的昵称展示 + 我的名次”，不能做“账号身份体系”。昵称不是身份键；两个同名用户只能靠 `rank` 区分，不能做用户级去重或好友关系。不排除平台内部存在未公开/白名单接口，但按官方在线文档和冻结基线，不能依赖，也不要去猜非公开 bridge。

补充三点，避免过度解读：

1. **`getMyRank` 不返回昵称**，本人昵称只有在进入前 100 的 `getRankList` 结果里才可见；不要假设“能读到自己的昵称”。
2. **文档没有给出昵称脱敏/掩码规则**；昵称按平台返回值原样展示，客户端只做长度截断和控制字符兜底，不自行打码、不拼接。
3. 文档中出现的 `uid` 只在 AI 内测加白说明里指“创作者提交自己的 uid”，不是端内读取用户身份的 API；不要把它当账号身份字段。

### 1.5 平台接入门禁

| 门禁 | 现状 | 证据 | 状态 |
| --- | --- | --- | --- |
| 排行榜内测资格 | 文档标注内测，尚未正式开放 | 在线文档 §3.2 / §3.17 | **未确认本 appId 是否有资格** |
| 客户端版本 | 9.51+ | 在线文档 §3.2 | 代码可门控；真机未测 |
| 上传勾选「用户头像昵称授权」 | 现有 `submit.json` 的 `authorizations` 为空；CLI `config` 只有 photos/camera/microphone/location | `minitool/submit.json:12`；`redapp config --source thirdAgent --agent` 返回 | **当前 thirdAgent 路径不可用（高置信）** |
| 容器白名单 | `10003` = 容器白名单拒绝 | 在线文档错误码表 | **未确认是否需单独申请** |
| 网页创服平台可勾选 | 网页有高级能力配置；CLI 没有相应字段 | `redapp-cli` 的 `references/form-limits.md` | **未验证该 appId 能否走网页补授权** |

> 重要：`redapp-cli` 文档说“网页有高级能力配置；当前 CLI 没有相应协议确认参数或高级能力字段”，并明确不要向 JSON 里加 `advancedAbilities`。因此不要尝试“猜一个 authorization code 塞进 submit.json”这种假闭环。

---

## 2. 技术方案

### 2.1 架构判断

当前小工具是**离线 H5 zip**：HTML/JS/CSS 全部本地打包，页面不能 `fetch` 自家后端，也不能加载外部图片/字体/脚本。排行榜调用不是网页网络请求，而是**容器 JS API bridge**：页面调用 `window.xhs.miniTool.submitScore(...)`，由小红书客户端转发到平台后端。这个区分是方案成立的前提。

```text
┌──────────────────────────────┐
│ 离线 H5（zip 内资源）         │
│  React/Preact UI             │
│  leaderboard port（适配层）   │
└──────────────┬───────────────┘
               │ window.xhs.miniTool.*（容器 bridge，不是 fetch）
┌──────────────▼───────────────┐
│ 小红书客户端（9.51+）         │
│  权限/白名单/版本门控         │
└──────────────┬───────────────┘
               │ 平台后端
┌──────────────▼───────────────┐
│ 排行榜服务（board 1–5）       │
│ 总/月/周/日四榜，最好成绩     │
└──────────────────────────────┘
```

**不引入**：自家后端、云函数、第三方 BaaS、埋点 SDK、WebSocket。原因不是“懒”，是页面根本不允许直连；任何“先 fetch 一下”的方案在容器里都会失败。

### 2.2 数据流

#### A. 结算页提交（每局一次）

```text
ResultScreen mount
  → detectCapability()
      ├─ 无 window.xhs / 无三方法 / buildVersion < 9510 → 隐藏榜单入口，结束
      └─ ready
  → submitScore({ board: DAY_TO_BOARD[day], score })   // 1 次/局，ref + runKey 去重
      ├─ ok → getMyRank({ board, period: 'week' })      // 1 次
      │       ├─ EXACT → 显示“本周第 N 名”
      │       ├─ OVER_LIMIT → 显示“500+”
      │       ├─ NO_SCORE → 显示“成绩同步中”，1s 后重试 1 次
      │       └─ NOT_PARTICIPATING → 显示“本期未上榜”
      └─ fail → 错误映射；不阻塞“再玩一次/返回首页”
```

调用量：`submitScore` 1 次 + `getMyRank` 1 次 = 基线 2 次/局（异常重试另计）。低分提交也成功，但不会覆盖最好成绩；UI 要写“榜单记录最好成绩”。

#### B. 打开榜单（用户主动）

```text
点击“查看同行榜”
  → getRankList({ board, period })   // 1 次，60s 内存缓存
  → getMyRank({ board, period })     // 1 次，30s 缓存；提交后失效
  → 渲染：前 100 + 我的名次（若在 100 外单独 pin）
```

调用量：2 次/次打开；手动刷新有 60s 冷却；不做轮询、不做后台刷新。

#### C. 周期切换

```text
切换 周榜/总榜
  → 先读内存缓存（key = board:period）
      ├─ 命中且 <60s → 直接渲染
      └─ 未命中/过期 → getRankList + getMyRank
```

### 2.3 榜位与分数策略

当前关卡与分数（`src/data/levels.ts`、`src/data/specs.ts:36`、`src/game/engine.ts:4`）：

| 关卡 | 访客数 | 满分 | 最低分 | 建议榜位 |
| --- | ---: | ---: | ---: | ---: |
| D01 | 8 | 800 | -1,200 | board 1 |
| D02 | 10 | 1,000 | -1,500 | board 2 |
| D03 | 12 | 1,200 | -1,800 | board 3 |
| D04 | 16 | 1,600 | -2,400 | board 4 |

计分规则：正确 +100，错误放行 -150，错误拒绝 -100（`src/game/engine.ts:4`）。所有分数都在榜单 ±1,000,000 范围内，**不需要缩放、不需要取整**。

**推荐：**

- `D01→1`、`D02→2`、`D03→3`、`D04→4`，映射是常量，写死并加单测；不要按数组下标动态算，避免关卡顺序调整时错位。
- 首版只开放 **week / all** 两个周期。理由：周榜有“周报/同行评议”的叙事，符合游戏调性；日榜容易变成“必须每天玩”的焦虑，和 `docs/design/levels-random.md:562` 的既有判断冲突。
- **不做 board 5 的跨关卡总榜。** 四关满分/最低分不同，raw score 不可直接比较；如果强行放在一个榜，D04 玩家天然吃亏。board 5 预留给未来的“周赛/活动/指定关卡”，不要为了凑满 5 个榜而硬做。
- 如果产品坚持要一个“综合榜”，给两个备选，必须产品签字：
  - **备选 A（推荐）**：board 5 = 全关卡最佳总和（`sum(Object.values(meta.bestByDay))`），是进度榜，不是单局榜；只有四关都有成绩才展示。优点是可比较、奖励完整体验；缺点是早期玩家分数低。
  - **备选 B**：board 5 = 单局百分制均分 `Math.round((score / total) * 1000) / 10`，标签写“综合均分（跨关卡，仅供参考）”。优点是每局都能上榜；缺点是 D01 100% 比 D04 100% 容易，存在难度偏差。
- **board 位是稀缺资源**：平台只给 1–5。当前 4 关刚好；未来加 D05 就会吃掉预留位。加关卡前必须重新评估榜位方案，不能默认“再加一个榜”。

### 2.4 数据结构与端口

建议新增一个独立适配层，组件不直接碰 `window.xhs`：

```ts
// 概念代码，不是本次要提交的实现
export type DayId = 'D01' | 'D02' | 'D03' | 'D04';
export type LeaderboardPeriod = 'week' | 'all' | 'month' | 'day';
export type MyRankStatus = 'EXACT' | 'OVER_LIMIT' | 'NO_SCORE' | 'NOT_PARTICIPATING';

export interface RankRow {
  rank: number;
  score: number;
  nickname: string | null;
}

export interface MyRank {
  status: MyRankStatus;
  rank: number | null;
  score: number | null;
}

export interface LeaderboardPort {
  detect(): Promise<'ready' | 'unsupported' | 'disabled'>;
  submit(board: number, score: number): Promise<{ score: number }>;
  list(board: number, period: LeaderboardPeriod): Promise<RankRow[]>;
  me(board: number, period: LeaderboardPeriod): Promise<MyRank>;
}

export const BOARD_BY_DAY: Record<DayId, number> = {
  D01: 1,
  D02: 2,
  D03: 3,
  D04: 4,
};
```

错误统一成带 `code` 的异常，UI 只认语义，不认原始 `errMsg`：

```ts
export type LeaderboardErrorKind =
  | 'auth'        // 1005 / 1006 / 10003
  | 'param'       // 1001 / 10001 / 1004
  | 'rate'        // 2009
  | 'not-ready'   // 2002
  | 'network'     // 无 errCode / 网关错误
  | 'server'      // 2008 / 2999
  | 'unknown';

export class LeaderboardError extends Error {
  constructor(
    public kind: LeaderboardErrorKind,
    public code?: number,
    message?: string,
  ) {
    super(message ?? kind);
  }
}
```

### 2.5 能力探测与版本门控

```ts
async function detectCapability(): Promise<'ready' | 'unsupported' | 'disabled'> {
  const mt = window.xhs && window.xhs.miniTool;
  if (!mt) return 'unsupported';
  if (
    typeof mt.submitScore !== 'function' ||
    typeof mt.getRankList !== 'function' ||
    typeof mt.getMyRank !== 'function'
  ) {
    return 'unsupported';
  }

  const build = await getBuildVersion(); // 复用 js-api.md:79-92 的判空逻辑
  if (!build || Math.floor(build / 1000) < 9510) return 'unsupported';

  return 'ready';
}
```

规则：

- **不在 app 启动时调用**，只在结算页/榜单页调用；避免影响首屏和离线体验。
- 版本号取不到（`0`）时按**不支持**处理，和基线对 Storage 的保守策略一致；不要“方法存在就假设能用”。
- `1005` / `1006` / `10003` 一旦出现，写入**会话级** `disabled` 标记，隐藏所有榜单入口；不要每局重试。
- 浏览器/网页版没有 `window.xhs`，自然隐藏；不要打印红色报错，不要影响单机玩法。
- React 18 `StrictMode`（`src/main.tsx:1`）在 dev 下 effect 会双跑；提交用 `runKey = day:seed:score` + `useRef` 去重，避免重复 `submitScore`。生产环境不会双跑，但测试会。
- 组件卸载/重开后，忽略旧 run 的异步回调（mounted ref + runKey 校验），避免把上一局名次写到下一局。

### 2.6 错误码与降级

| `errCode` | 含义 | UI/行为 | 是否重试 |
| --- | --- | --- | --- |
| `1001` / `10001` | 参数错误 | 记录一次，隐藏本局提交；不打扰用户 | 否 |
| `1004` | 分数越界 | 提交前守卫；出现即视为 bug，跳过 | 否 |
| `1005` / `1006` | 排行榜/云存储未授权 | 隐藏入口，会话级禁用；文案“当前客户端未开通排行榜” | 否 |
| `10003` | 容器白名单拒绝 | 同上 | 否 |
| `2002` | 榜单缓存未就绪 | loading，按 500ms/1s/2s/4s 退避；4 次后显示“稍后再试” | 是，最多 4 次 |
| `2009` | 限频 | 2s 后重试 1 次；仍失败则“稍后再试” | 是，最多 1 次 |
| `2008` | 授权服务不可用 | 重试 1 次；仍失败则降级 | 是，最多 1 次 |
| `2999` | 内部错误 | 重试 1 次；仍失败则通用错误 | 是，最多 1 次 |
| 无 `errCode` | 网关/网络 | “网络不可用，单机成绩已保存”，提供重试 | 手动 |
| 未知 | 未知 | 通用错误；不无限重试 | 手动 |

**关键区分：**

- `data: []` 才是真空榜，显示“本期还没有记录，来当第一个”。
- `2002` 是“还没准备好”，不是空榜；显示 loading/重试，不要显示“暂无数据”。
- `1005` / `10003` 是“没资格/没授权”，不是“网络错误”；不要给用户“重试”按钮，重试也不会好。
- `NO_SCORE` 是“已参与本期但无成绩”，可以显示“成绩同步中”，1s 后重试一次；不要直接判失败。

### 2.7 缓存与配额

| 项 | 方案 |
| --- | --- |
| 榜单列表缓存 | 内存 `Map<string, { data, at }>`，key 为 `${board}:${period}`，TTL 60s，最多 8 条 |
| 我的名次缓存 | 内存 TTL 30s；`submitScore` 成功后失效对应 key |
| 持久化 | **不持久化昵称/榜单**；不写 `localStorage` / Storage / 文件 / 日志 |
| 并发 | 同一 key 的 in-flight 请求复用同一个 Promise，避免连点重复请求 |
| 手动刷新 | 60s 冷却；按钮 `disabled` + 剩余秒数 |
| 轮询 | 不做；没有后台刷新、没有定时器 |
| 调用量 | 每局基线 2 次（异常重试另计）；每次打开榜单 2 次；远低于 150 QPS/接口 |
| 限频兜底 | `2009` 退避 2s；不因为重试把配额打满 |

补充：

- 平台限频是“小工具 × 接口”150 QPS，不是“每用户 150 QPS”；当前量级安全。但**每用户配额文档未给出**，所以仍要“每局只提交一次、榜单只读一次”。
- 不要缓存 `nickname` 到磁盘；文档明确“不得自行采集或存储用户小红书资料”。内存 60s 展示缓存是文档自己建议的“本地缓存 30–60s”，可以接受；如果审核方更严格，降到 30s 或不缓存。
- 本地 `meta.bestScore` / `bestByDay` 是游戏数据，不是小红书用户资料；可以继续用现有 `localStorage`，但不要把榜单数据混进去。
- **现有 `localStorage` 在容器内是否稳定，本次未复测。** 如果容器禁用 `localStorage`，个人最佳兜底会失效，需要迁移到 `window.xhs.miniTool.setStorage` / `getStorage`（9.46+）。这是独立技术债，不要和排行榜混在一起；排行榜的内存缓存不依赖它。

### 2.8 离线/无网兜底

| 场景 | 表现 |
| --- | --- |
| 网页版 / 无 `window.xhs` | 榜单入口完全隐藏；单机玩法不变 |
| 客户端 < 9.51 | 入口隐藏；不提示“升级”，避免干扰 |
| 有 API 但未授权（1005） | 入口隐藏；结果页只显示本地最高分 |
| 有 API 但白名单拒绝（10003） | 同上 |
| 网络断开/网关错误 | 结果页正常显示分数；榜单卡片显示“排行榜暂不可用”，提供重试 |
| 2002 缓存未就绪 | 榜单页 loading + 退避；不阻塞结算 |
| 提交失败 | 不影响“再玩一次/返回首页”；本地最高分仍然保存 |
| 提交成功但榜单未更新 | 显示“成绩已提交，榜单同步中”；不要谎报名次 |

**产品口径：** 单机核心永远可离线；排行榜是“可选在线增强”。首页文案从“无后端 / 无 API / 可离线”（`src/screens/HomeScreen.tsx:110`）改为“单机可离线 · 排行榜需小红书客户端联网”，并在榜单页补昵称授权说明。

### 2.9 UI 融入

#### 结算页（`src/screens/ResultScreen.tsx`）

- 位置：总分/评级之后、“再玩一次/返回首页”之前（当前第 71 行总分、第 133–134 行按钮）。
- 内容：
  - 可用且提交成功：“本关本周第 12 名 · 本周最好 980”或“500+”。
  - 提交中：“成绩同步中…”。
  - 不可用：不显示卡片，或显示一行“排行榜未开通”（仅调试/内测可见）。
  - 失败：“排行榜暂不可用”，不抢按钮焦点。
- 交互：“查看同行榜”打开全屏 sheet；不要新开路由，避免影响现有 `phase` 状态机。
- 不阻塞：提交是后台异步；按钮立即可点。

#### 榜单页（新增 `LeaderboardScreen` / sheet）

- 标题建议：“边境同行榜 / PEER LEDGER”，贴合世界观，不用“排行榜”三个字做大标题。
- Tab：`本周` / `总榜`；首版不做 `日榜`、`月榜`（可留代码枚举，不暴露 UI）。
- 列表行：`NO.001` + 昵称（截断 12 字符）+ 分数；前三名加徽章；不做头像。
- 我的名次：底部固定条；若在 100 名内，按 `my.rank` 匹配并高亮对应行（**不要按昵称匹配**，同名/改名会错）；若在 100 外，显示“我的排名 137”；`OVER_LIMIT` 显示“500+”；`NO_SCORE`/`NOT_PARTICIPATING` 显示“本期未上榜”。
- 列表和“我的名次”是两个独立请求：列表失败显示列表错误态，我的名次失败只隐藏底部条；不要因为一个失败把整个 sheet 判死。
- 空态：“本期还没有记录，来当第一个。”
- 错误态：按 2.6 映射；`1005`/`10003` 不显示重试。
- 隐私脚注：“榜单昵称由小红书提供，仅用于本工具内展示；本工具不采集、不存储用户资料。”
- 周期脚注：“周榜每周一 00:00（北京时间）重置；总榜不重置。”
- 无障碍：复用现有 modal a11y（焦点陷阱、Esc 关闭、`aria-live` 播报 loading/error）；触控目标 ≥44px；对比度满足现有规范。
- Chrome 61：不引入 `gap` 无回退、`clamp()`、`:is()`、`aspect-ratio` 等新语法；沿用现有 CSS 变量与类。

#### 首页（`src/screens/HomeScreen.tsx:110`）

- 首版不加榜单入口，避免启动时探测/请求；只改文案。
- 如果第二阶段要加入口，做成“结算后解锁”的弱入口，不做首屏主 CTA。

### 2.10 构建、兼容与预算

| 约束 | 现状 | 对榜单的影响 |
| --- | --- | --- |
| 构建 target | `['es2017','chrome61']`（`minitool/vite.minitool.config.mjs:21`） | 新代码避免 `at` / `flat` / `fromEntries` / `replaceAll` / `Promise.allSettled` 等 Chrome 61 不支持的 built-in |
| 脚本形态 | classic + `defer`；禁止内联脚本（`minitool/postprocess.mjs`） | 新组件正常走 bundle，不写内联脚本 |
| 首屏 JS 预算 | gzip ≤70kB；web `dist` 33.60kB（48.0%）；小工具 zip 35.21kB | zip 口径余量约 35kB；预计榜单 +4–6kB，安全 |
| 首屏 CSS 预算 | gzip ≤6.2kB；web `dist` 5.90kB（94.6%）；小工具 zip `style.css` 6,142B | web 余量约 330B；**zip 余量约 58B（按 6,200B 预算）**；榜单 UI 必须按更紧的 zip 口径控制 |
| 总 raw 预算 | ≤260kB；web `dist` 127.26kB（48.9%）；zip 压缩包 42.6kB、解包 raw 129.9kB | 安全 |
| 打包链路 | build → postprocess → manifest → audit → zip → audit（`docs/minitool-0.1.0-release.md:80-100`） | 每次提交都要跑完整链路，不能只跑 `vite build` |
| 门禁 | `npm run verify:all`（`docs/GIT_WORKFLOW.md:41`） | `verify:all` 只构建/预算/验收 web `dist`，**不构建也不审计 minitool zip**；zip 必须单独跑 §5.4 链路 |

**CSS 预算是本方案最容易被低估的成本，而且没有“raw 1.5kB”这种余地。** 这里有两个口径，不能混：

- web `dist` 门禁：5.90kB / 6.2kB（94.6%），余量约 330B gzip；`npm run verify:all` 测的是这个。
- 小工具 zip：`style.css` gzip 6,142B，6,200B 预算只剩约 58B；`verify:all` **不覆盖** zip，不能拿 web 的 330B 当安全垫。

榜单页的 tab、列表行、空态、错误态、我的名次条，至少十几个新类；即使全部复用 `panel` / `row` / `chip` / `button`，新增样式也很可能超过 58B gzip。**实施前必须先做一次 CSS 去重/压缩，目标释放 ≥0.5kB gzip，再开任何榜单 UI（包括 P1 的结算卡片）；否则 P1/P2 会卡在 zip 预算（或被迫改预算）。** 不要用 raw 体积自欺，raw 不是门禁口径。

**测试栈现实：** `package.json` 的测试命令是 `node --experimental-strip-types --test tests/*.test.ts`，没有 jsdom。适配层、错误映射、board 映射用纯函数单测；React UI 不强行引入 DOM 测试，走构建 + 真机验收。不要把“浏览器里手点通过”当成容器 API 通过。

---

## 3. 风险与合规

### 3.1 隐私与数据最小化

- **只展示 `nickname`，不采集 uid/openid/头像**；没有身份键，也不建用户档案。
- **不持久化昵称**：不写 `localStorage`、不写 `window.xhs.miniTool.setStorage`、不写文件、不打日志、不发埋点。
- **不做跨会话追踪**：内存缓存 60s，页面关闭即失；不做“最近访问用户”列表。
- **不做用户画像**：不根据昵称推断性别/地域/年龄；不做个性化推荐。
- **不外发**：页面本身不能联网；不引入第三方 SDK；不把昵称拼进任何 URL/图片。
- **渲染安全**：React 默认转义；禁止 `dangerouslySetInnerHTML`；昵称截断 12 字符、去除控制字符；`nickname === null` 时用“匿名审核员”。

### 3.2 昵称与头像展示

- **昵称**：可以展示，但必须写“由小红书提供，仅用于本工具内展示”；不改写、不拼接、不生成衍生内容。
- **头像**：当前契约没有 `avatar`，**不要显示头像**；也不要用像素头像/首字母生成“伪头像”，避免让用户误以为是账号头像。
- **同名**：名次唯一，用 `rank` 区分；不要做“同名合并”。
- **空昵称**：`null` 时统一兜底；不要显示“null”“undefined”。
- **敏感昵称**：平台侧应有审核；客户端只做长度/控制字符兜底，不做内容审查（没有审核能力，也不应自建）。

### 3.3 审核与授权口径

- **上传必须勾选「用户头像昵称授权」**。这是文档明确的硬要求；未勾选会 `1005`。当前 `minitool/submit.json:12` 是 `authorizations: []`，`redapp config` 也没有该 code，因此**现有 thirdAgent CLI 上传路径不能直接满足**。
- **可选路径**：
  1. 网页创服平台上传 0.2.0，手动勾选该授权（需确认该 appId 是否可在网页管理；**未验证**）。
  2. 让平台给 thirdAgent 增加该授权字段/协议（**未验证，周期不可控**）。
  3. 如果两条都不通，**不要上排行榜**；保留本地最佳，避免“代码写了但线上 1005”的假交付。
- **审核文案**：榜单页脚注 + 发布说明 + 隐私说明三处一致；不要写“我们收集昵称用于排行榜”，要写“昵称由平台提供，仅用于展示”。
- **审核风险**：排行榜属于新能力，审核员可能按“社交/排名”类目问询；提前准备：数据来源、授权项、无存储、无奖励、无诱导分享。**审核通过率未验证**。
- **既有文案冲突**：`src/screens/HomeScreen.tsx:110` 和 `docs/minitool-0.1.0-release.md:172` 的“无后端 / 无 API / 可离线 / 无平台授权项”必须同步改；否则审核/用户会认为描述不实。

### 3.4 成绩完整性

- 平台没有给客户端签名/防作弊契约；`submitScore` 接受任意 ±1,000,000 的分数。按公开契约推断，**客户端分数不可信**；平台是否有未公开的防作弊，未验证。这是能力边界，不是本方案的漏洞。
- 因此：**不要把榜单和实物奖励、付费权益、抽奖、排名返利绑定**；榜单只做荣誉展示。
- 如果未来要做竞技赛季，必须引入服务端校验/回放/签名，而当前架构没有自家后端；这会是另一个量级的项目，不在本次范围。
- 同分先到先得、名次唯一；不要做“并列”，避免解释成本。

### 3.5 产品调性与既有 Non-goal

这是本次评估最容易被技术侧忽略的风险：

- `docs/design/levels-random.md:459` 把“排行榜”列为不做；
- `docs/design/levels-random.md:562` 的理由是“需服务端或制造‘必须今天玩’的焦虑，与本作调性冲突”，复审条件是“回访率 > 35% 时只做本地每日 seed”；
- `docs/design/levels-random-cto.md:7` 把“后端 / 在线排行榜”列为 Non-goals。

平台内测排行榜解决了“需服务端”的一半，但**没有解决“焦虑/调性”**。而且当前没有遥测/后端，端内**测不了 35% 回访率**；平台后台是否有可用的留存数据，**未验证**。

建议：

- 把榜单定位为“可选的同行档案/周报排名”，不做每日 streak、不做“今天不玩就掉榜”的提示、不做排名奖励、不做 push。
- 首版只做周榜/总榜，不做日榜；文案用“同行榜/档案”而不是“淘汰榜”。
- **必须由产品 owner 对既有 Non-goal 做一次显式签字**；技术侧不能静默推翻产品决策。签字记录放 `docs/leaderboard-feasibility.md` 或决策日志。
- 如果产品无法签字，或者平台数据无法验证留存，**建议推迟到排行榜 GA/有明确运营目标时再做**。

### 3.6 平台依赖与版本碎片

- 排行榜是内测，随时可能变更/回收；文档自己写“请勿作为核心功能的唯一依赖”。所以入口必须是**可选增强**，不能影响单机主流程。
- 客户端 9.51+ 才支持；低于此版本的用户看不到入口。最低基线 Android 8.1 / Chrome 61 仍要保证单机可玩。
- 没有远程 kill switch：如果线上榜单出问题，只能发新版本隐藏入口。因此：
  - 首版用**本地 feature flag**（构建时常量）控制，默认关闭，验证通过后再打开；
  - 保留 0.1.x 的回滚包；
  - 榜单失败不阻塞结算，避免“一个 API 挂了，整个游戏不能玩”。
- 平台限频/缓存未就绪是常态，不是异常；按 2.6/2.7 退避，不要把它当“重大故障”。

### 3.7 风险登记表

| # | 风险 | 概率 | 影响 | 缓解 | Owner |
| --- | --- | --- | --- | --- | --- |
| R1 | 本 appId 无内测/白名单资格 | 高 | 不能上线 | P0 先申请；不过则停在本地最佳 | 平台对接人 |
| R2 | thirdAgent 无法勾选头像昵称授权 | 高 | 不能提交 | 网页创服补授权，或平台加协议；不过则不做 | 平台对接人 + 前端 |
| R3 | 账号身份 API 不存在 | 确定 | 需求降级 | 只做昵称展示；不做好友/画像 | 产品 |
| R4 | 审核按社交/排名类目问询或拒绝 | 中 | 上线延迟 | 准备隐私/授权/无奖励说明；先内测 | 产品 + 法务 |
| R5 | 昵称 null/敏感/超长 | 中 | 展示异常 | 兜底、截断、转义；平台审核 | 前端 |
| R6 | 分数可篡改 | 中 | 榜单公信力 | 不绑奖励；标注荣誉榜；未来做服务端校验 | 产品 |
| R7 | 产品调性冲突 | 中高 | 决策返工 | 产品 owner 签字；弱化入口；不做日榜/奖励 | 产品 |
| R8 | 版本碎片（<9.51） | 中 | 部分用户不可见 | 能力探测；隐藏而非报错 | 前端 |
| R9 | 2002/2009 频繁 | 低中 | 体验抖动 | 退避、缓存、手动重试 | 前端 |
| R10 | board 位耗尽（未来 D05） | 低（当前） | 扩展受限 | 冻结 1–4；新增关卡前重评 | CTO |
| R11 | CSS 预算爆 | 中 | 构建失败/被迫删功能 | 复用类；先做 CSS 盘点；1.5kB 上限 | 前端 |
| R12 | 无远程 kill switch | 中 | 故障恢复慢 | feature flag；0.1.x 回滚包；不阻塞主流程 | 前端 |
| R13 | 无端内留存数据，无法验证 35% 条件 | 高 | 决策依据缺失 | 用平台后台（未验证）或推迟 | 产品 |
| R14 | 容器内 `localStorage` 不稳定，个人最佳兜底失效 | 低中 | 中 | 复测；必要时迁移 Storage API（9.46+） | 前端 |

---

## 4. 分期落地建议

| 阶段 | 范围 | 产出 | 工作量（人日） | 退出标准 |
| --- | --- | --- | ---: | --- |
| **P0 平台门禁** | 确认本 appId 内测资格、授权勾选、白名单、9.51+ 真机；尽量用独立测试 appId，不动已发布 app | 一页验证记录 + 截图/错误码 | 0.5–1 | `getRankList` 真机返回正常列表或 `data: []`；`submitScore` 不报 1005/10003；授权项可见 |
| **P1 适配层 + 结算提交** | `LeaderboardPort`、能力探测、错误映射、`submitScore` + `getMyRank`、结算页卡片、feature flag 默认关 | 可运行的“我的名次”；无榜单列表 | 1.5–2 | 单测覆盖探测/错误/去重；真机提交成功；不阻塞结算 |
| **P2 榜单页** | 周榜/总榜、前 100、我的名次 pin、空/loading/error/offline、缓存、a11y | 完整榜单 sheet | 2–3 | 真机覆盖 EXACT/OVER_LIMIT/NO_SCORE/2002/1005/断网；CSS 预算内 |
| **P3 合规与送审** | 文案、发布说明、网页授权、preview、审核、回滚包 | 0.2.0 送审/发布 | 1–2 | 审核通过；线上真机回归；0.1.x 可回滚 |
| **合计** | 不含平台审批等待 | — | **5–8** | 置信度中；最大不确定性是 R1/R2 |

**只做“我的名次”、不做榜单列表**：P0 + P1，约 **2–3 人日**；如果 CSS 需要先做去重，另加 0.5–1 人日。  
**完整榜单**：P0–P3，约 **5–8 人日**，另加平台审批等待（时长未知）。

**Stop conditions（必须停）：**

- P0 拿不到内测/白名单，或授权项无法勾选；
- 真机 9.51+ 调用仍 1005/10003，且平台无法给出开通路径；
- 产品 owner 不认可对既有 Non-goal 的修改；
- CSS/JS 预算无法在复用现有样式的前提下满足。

停的时候不丢人，硬上才丢人；代码写了但线上 1005，那叫自嗨，不叫交付。

---

## 5. 分支与任务拆分

### 5.1 当前 Git 状态

- HEAD：`c8beb1b`，分支 `feat/minitool-0.1.0`；
- 该分支包含 `4e52c6f`（0.1.0 送审）和 `c8beb1b`（全屏留白修复）；
- 本地 `main` 与 `origin/main` 均为 `14a20d6`，**0.1.0 的两个提交尚未合入 main**；
- 评估开始时工作区 clean；本次只新增本文档（untracked），未改代码；
- `redapp status` 于 2026-11-08 返回 `status=2 / 已发布`；`PROJECT_STATUS.md:4`、`:1120` 仍写 `status=1 / 审核中`，**已过期**。这是文档状态问题，不是代码问题，但在做 0.2.0 前应更正，避免基于错误状态做决策。

### 5.2 是否新建 feat 分支

**应该建，但不要在 0.1.0 未合入 main 时直接叠。** 推荐顺序：

1. 先把 `feat/minitool-0.1.0` 走 PR 合入 `main`（`verify:all` 绿），确保线上版本和主线一致；
2. 从最新 `origin/main` 开 `feat/minitool-leaderboard`；
3. 0.2.0 的版本号在 `minitool/submit.json` 里改，不要用分支名表达版本。

```bash
# 0.1.0 合入后
git switch main
git pull --ff-only
git switch -c feat/minitool-leaderboard
```

如果暂时不能合 0.1.0，也可以从当前 HEAD 开分支，但要在 PR 前 rebase：

```bash
git switch -c feat/minitool-leaderboard
# 之后
git fetch origin
git rebase origin/main
```

分支命名：`feat/minitool-leaderboard`。理由：符合 `docs/GIT_WORKFLOW.md:13` 的 `feat/<slug>`；范围明确（小工具排行榜），不和未来的“通用社交”混淆。不要叫 `feat/leaderboard-0.2.0`，版本号不是分支职责。

### 5.3 提交拆分

| # | Commit | 范围 | 主要文件 | 验收 |
| --- | --- | --- | --- | --- |
| 1 | `feat(leaderboard): 平台适配层与能力探测` | 类型、`LeaderboardPort`、`detect`、错误映射、board 映射、`window.xhs` 类型声明、单测；**无 UI** | `src/game/leaderboard/*`、`src/types/xhs.d.ts`、`tests/leaderboard.test.ts` | 单测覆盖无 API/旧版本/ready/错误码；`verify:all` 绿 |
| 2 | `feat(leaderboard): 结算页提交与我的名次` | `submitScore` + `getMyRank`、去重、结算卡片、feature flag | `src/hooks/useLeaderboard.ts`、`src/screens/ResultScreen.tsx`、`src/App.tsx` | 真机提交成功；StrictMode 不双提交；失败不阻塞按钮 |
| 3 | `feat(leaderboard): 同行榜页面与降级` | 周/总榜、前 100、我的名次、空/loading/error/offline、缓存、a11y | `src/screens/LeaderboardScreen.tsx`、`src/styles/*`、modal 复用 | 真机覆盖 EXACT/OVER_LIMIT/2002/1005/断网；CSS/JS 预算内 |
| 4 | `docs(release): 0.2.0 排行榜授权与隐私口径` | 首页文案、发布说明、PROJECT_STATUS、授权清单 | `src/screens/HomeScreen.tsx:110`、`docs/minitool-0.2.0-release.md`、`PROJECT_STATUS.md` | 文案一致；无“无 API/无授权项”残留 |
| 5 | `test(leaderboard): 真机与错误码验收记录` | 真机截图、错误码、版本、设备信息 | `docs/leaderboard-qa.md` | 证据可复核；不把“浏览器跑通”当容器验证 |

### 5.4 验收命令

```bash
npm run verify:all
npx vite build --config minitool/vite.minitool.config.mjs
node minitool/postprocess.mjs
node ~/.dsh/skills/minitool-zip-builder/scripts/write_manifest.mjs dist-minitool false
node ~/.dsh/skills/minitool-zip-builder/scripts/audit_artifact.mjs dist-minitool
(cd dist-minitool && zip -rX ../ai-please-minitool.zip . -x '*.DS_Store')
node ~/.dsh/skills/minitool-zip-builder/scripts/audit_artifact.mjs ai-please-minitool.zip
```

真机验收必须覆盖：

- 9.51+ 且已授权：提交成功、周榜/总榜、我的名次；
- 9.51+ 未授权：1005，入口隐藏，不崩；
- 9.50 或更低：入口隐藏；
- 断网：结算正常，榜单显示离线态；
- 2002：loading + 退避，不显示空榜；
- 空榜：`data: []` 显示空态；
- 昵称 null：兜底文案；
- Android 8.1 / Chrome 61 基线：布局不炸、无新语法报错。

**注意：** 浏览器直接打开 Vite dev server **不能**证明容器 API 可用；必须用 `redapp dev` / 真机容器验证。浏览器里只能验证 UI 和 mock 逻辑。

---

## 6. 未验证清单

以下事项没有足够证据，实施前必须逐项确认；不要把它们当“应该没问题”：

1. **本 appId 是否具备排行榜内测资格**；申请入口、审批时长未知。
2. **该 appId 能否在网页创服平台补勾「用户头像昵称授权」**；原 thirdAgent 创建的 app 是否可在网页管理，未验证。
3. **thirdAgent CLI 是否会在近期支持该授权字段**；当前 `redapp config` 只有 photos/camera/microphone/location，`form-limits.md` 说 CLI 没有高级能力字段。
4. **是否需要单独的容器白名单**；`10003` 的触发条件、申请方式未说明。
5. **`getRankList` 是否在任何变体里返回头像**；当前契约没有，不要假设。
6. **每用户提交配额/防作弊策略**；文档只给“小工具 × 接口”150 QPS，没有用户级配额。
7. **审核对“排行榜/社交排名”的通过率**；没有先例。
8. **Android 8.1 / iOS 真机在 9.51+ 的实际表现**；未测。
9. **平台后台是否提供留存数据**，能否验证 `levels-random.md:562` 的 35% 条件；未验证。
10. **昵称的长度/控制字符/敏感内容审核规则**；客户端只做防御性处理。
11. **board 1–5 是否严格按小工具隔离**；文档语义如此，但未显式写“跨小工具不共享”，按隔离假设设计。
12. **`submitScore` 对 0/负分/小数的边界行为**；契约是 `number`、不缩放不取整、范围 ±1,000,000，小数与负分在契约内应可用；真机未验证边界，备选 B 上线前要实测。
13. **`getMyRank` 在从未提交时是否稳定返回 `NOT_PARTICIPATING`**；契约如此，真机未验证。
14. **独立测试 appId 是否可申请**；如果没有，P0 只能用 preview/体验版，不能动已发布 0.1.0。

---

## 7. 决策记录

| 项 | 内容 |
| --- | --- |
| 决策 | 平台排行榜：**Conditional GO**；账号身份读取：**NO-GO** |
| 首版范围 | board 1–4 单关榜；周榜/总榜；昵称展示；无头像；无 board 5；无好友榜 |
| 前置条件 | P0 平台门禁 + 产品 owner 对既有 Non-goal 签字 + 授权路径确认 |
| 不做什么 | 不读 uid/openid/头像；不自建后端；不绑奖励；不做日榜/streak；不持久化昵称 |
| 回滚 | feature flag 默认关；0.1.x 回滚包；失败不阻塞主流程 |
| 复审 | 排行榜 GA、平台提供身份/好友 API、或产品明确要竞技赛季时 |
| 批准 | 产品 owner：______；CTO：______；日期：______ |

---

## 附录 A：证据索引

| # | 证据 | 位置 | 用途 |
| --- | --- | --- | --- |
| E1 | 冻结基线 API 一览 | `/Users/lusuallen/.dsh/skills/minitool-zip-builder/references/js-api.md:30-36` | 证明基线无排行榜/用户信息 |
| E2 | 基线“只调用本文列出的 API” | 同上 `:12` | 证明不能调未列 API |
| E3 | 基线版本读取 | 同上 `:75-92` | 复用 `getBuildVersion` 判空逻辑 |
| E4 | 在线文档排行榜 | <https://miniapp-sandbox.xiaohongshu.com/minitool/doc> §3.17 | 证明内测、board/period/rank/错误码 |
| E5 | 在线文档 API 一览 | 同上 §3.2 | 证明 9.51+、内测 |
| E6 | 在线文档云存储 | 同上 §3.16 | 证明按用户隔离，不能当公共榜 |
| E7 | 在线文档网络限制 | 同上 §4.1/4.2 | 证明不能 fetch/自建后端 |
| E8 | 第三方 Agent 限制 | 同上 §1.1 | 仅点名 AI 内测，不外推排行榜 |
| E9 | 结算页 | `src/screens/ResultScreen.tsx:15,71,133-134` | 榜单卡片插入点 |
| E10 | 成绩持久化 | `src/hooks/useGame.ts:235-252` | 本地最佳兜底 |
| E11 | 计分规则 | `src/game/engine.ts:4` | 分数范围与榜位设计 |
| E12 | 关卡访客数 | `src/data/levels.ts`、`src/data/specs.ts:36` | 满分/最低分计算 |
| E13 | 首页离线文案 | `src/screens/HomeScreen.tsx:110` | 必须改口径 |
| E14 | 发布说明“无平台授权项” | `docs/minitool-0.1.0-release.md:172` | 必须改口径 |
| E15 | 上传授权为空 | `minitool/submit.json:6,12` | 证明当前不能提交排行榜 |
| E16 | CLI 授权列表 | `redapp config --source thirdAgent --agent` 输出 | 只有 photos/camera/microphone/location |
| E17 | CLI 限制 | `redapp-cli` 的 `references/form-limits.md` | 网页有高级能力，CLI 没有 |
| E18 | 既有 Non-goal | `docs/design/levels-random.md:459,562`；`docs/design/levels-random-cto.md:7` | 产品签字依据 |
| E19 | 分支规范/门禁 | `docs/GIT_WORKFLOW.md:13,19,21,41` | 分支与验收 |
| E20 | 构建 target | `minitool/vite.minitool.config.mjs:21` | Chrome 61 兼容 |
| E21 | 预算门禁 | `scripts/check-budget.mjs`；`ai-please-minitool.zip` 解包 `style.css` | web `dist` CSS 5.90kB/6.2kB；zip CSS 6,142B/6.2kB（余量约 58B）；`verify:all` 不覆盖 zip |
| E22 | 平台状态 | `redapp status` 2026-11-08：status=2 已发布 | 纠正 PROJECT_STATUS 过期记录 |

## 附录 B：建议文案

**首页 footer（替换 `HomeScreen.tsx:110`）：**

> 最高分 BEST SCORE {meta.bestScore} · 本作为虚构世界观 · 单机可离线；排行榜需小红书客户端联网

**榜单页脚注：**

> 榜单昵称由小红书提供，仅用于本工具内展示；本工具不采集、不存储用户资料。每周一 00:00（北京时间）重置。

**空态：**

> 本期还没有记录。来当第一个。

**2002：**

> 榜单正在同步，稍等一下。

**1005 / 10003：**

> 当前客户端未开通排行榜。单机成绩不受影响。

**OVER_LIMIT：**

> 我的排名：500+

**NO_SCORE / NOT_PARTICIPATING：**

> 本期未上榜。完成一局后就会记录最好成绩。

**结算卡片：**

> 本周第 12 名 · 本周最好 980  
> 榜单记录你的最好成绩，低分不会覆盖高分。

---

**最后一句：** 这个方案的上限不是前端写得多漂亮，而是平台给不给资格、给不给授权。P0 门禁不过，所有 UI 都是自嗨；P0 过了，按 5–8 人日分阶段交付，别一口吃成胖子。

---

## 8. P1 实施记录（分支 `feat/minitool-leaderboard`）

**范围收口**：只做「提交我的成绩 → 显示昵称 → 本周分数 → 本周名次」。
好友榜、头像、可切换的月/日榜、全量前 100 列表一律不做——不是没时间，是这些都要额外授权面，与本次「小范围」口径不符。

### 8.1 落地文件

| 文件 | 职责 |
| --- | --- |
| `src/game/leaderboard.ts` | 纯适配层：榜位映射、分数校验、昵称归一化、错误码归档、2002 退避重试、`readMyRank` |
| `src/hooks/useLeaderboardRank.ts` | 状态机：版本门槛 → 提交（模块级去重，StrictMode 双挂载安全）→ 读名次 → 前 100 名补昵称 |
| `src/screens/ResultScreen.tsx` | 结算页 `LeaderboardPanel`，全部复用 `.panel` / `.result-cell`，零新增 CSS、零动画 |
| `src/screens/HomeScreen.tsx` | 首页口径修正：`无后端 / 无 API / 可离线` → `单机可离线 · 排行榜需小红书客户端联网` |

### 8.2 平台能力映射

| 文档能力 | 本次用法 |
| --- | --- |
| `submitScore({board, score})` | 结算页挂载时上行一次，key = `day:seed:score`；分数先过 ±1,000,000 本地校验 |
| `getMyRank({board, period})` | `period='week'`，先判 `status` 再决定文案 |
| `getRankList({board, period})` | **只在** `EXACT && rank ≤ 100` 时补一次，为拿昵称；101–500 名不白打接口 |

降级矩阵：`2002 / 2009 / 无 errCode` → 卡片显示「排行榜暂不可用」+ 重试；`1005 / 1006 / 10003 / 1004` → 整卡隐藏，游戏其余部分不受影响。

### 8.3 验收证据（2026-11-08）

- `npm test` → **80 pass / 0 fail**，其中 `tests/leaderboard.test.ts` 新增 19 条断言（含「候选关卡必须登记榜位」「101–500 名不查列表」「只有 2002 重试」）。
- `npm run build` → 通过；首屏 JS gzip 35.70 kB / 70 kB，首屏 CSS 5.87 kB / 6.2 kB，总产物 133.22 kB / 260 kB。
- 小工具产物（**必须含 postprocess 环节**）→ `style.css` raw 28,212 B / gzip -9 6,236 B、`app.js` gzip -9 37,329 B、`compat.js` 540 B；`audit_artifact.mjs dist-minitool` → PASS 5 files / 0 warning；`ai-please-minitool.zip` 44,888 B，审计 PASS。
  - 早先记录的「PASS 4 files / 44,129 B」是漏跑 `node minitool/postprocess.mjs` 的无效产物（`index.html` 仍是 `type="module" crossorigin`、无 `compat.js`、CSS 缺 `--pad-top:104px` 与 gap 回退），已作废。
- 排版取证（Chrome CDP，`Emulation.setDeviceMetricsOverride`，320 / 375 / 390 / 430 四档）→ `scrollWidth === clientWidth`，横向溢出元素 0 个，`.panel .tag` 右边缘始终在视口内。
- 数字口径（已复核，含 0.1.0 对照构建）：`scripts/check-budget.mjs` 的 6,200 B 只作用于 `dist/`（网页产物，当前 5,890 B，绿），不覆盖小工具 zip。小工具 CSS 6,236 B 是 postprocess 回退段的固有开销——在 worktree 里重建 0.1.0（c8beb1b）得到 raw 28,212 B / gzip 6,236 B，与本分支**完全相同**，即排行榜新增 0 字节 CSS（app.js gzip 35,221 → 37,329，+2,108 B）。

### 8.4 仍未验证（必须在上线前补）

1. **授权勾选**：创服后台「用户头像昵称授权」未勾选时，`submitScore` 返回 1005，卡片会整块隐藏——这是设计行为，不是 bug，但线上等于没功能。
2. **白名单 / 内测资格**：10003 未开通时同上隐藏。
3. **真机容器**：`window.xhs.miniTool` 在 9.51+ 容器内是否存在、`buildVersion` 是否可读，本地只能用注入桩验证；真机需上传体验版实测一次。
4. 昵称在 101–500 名不可得，属平台限制；文案已说明「前 100 名才显示昵称」，不假装有数据。

## 9. 0.2.0 发版状态（2026-11-08 21:37）

| 环节 | 状态 | 证据 |
| --- | --- | --- |
| 版本号 | 0.2.0 | `package.json` / `package-lock.json` / `minitool/submit.json` / `minitool/preview.json` 已统一 |
| 代码包上传 | ✅ 已完成 | upload confirm → `fileId=red_app/j7-K0DblfxBZjyNG2f4WzcM1QuFdSJVECvyWE2RyA1W4SG8.zip`，`md5=e4024120971d4f25b5c16eef1866ef71`，44,888 B |
| 手机预览 | ✅ 已生成 | `previewUrl=xhsdiscover://miniTool/6af07b0b261c1b00157cef08_develop?xhsMpScreenMode=full`，二维码 `minitool/preview-qr-5.png`（本地，`.gitignore` 忽略） |
| 送审 submit | ⛔️ 未执行 | 阻塞：①「用户头像昵称授权」在 CLI 无对应 code（`redapp config` 仅 photos/camera/microphone/location），必须网页创服后台勾选；②需用户扫码回复「预览通过，可以送审」 |

补充结论：

1. **授权是运行时开关，不是构建开关**。未勾选时卡片整块 `hidden`（1005/1006/10003/1004 一律降级），线上唯一可见差异是首页 footer 文案。因此预览能验「降级干净」，不能验「功能可用」；功能可用的唯一验证路径是真机 + 已勾授权。
2. **0.1.0 没有字节级回滚资产**。在 worktree 用 c8beb1b 重建的 zip md5 为 `9449a07be81b15e65a930ba0c2490392`，与送审时的 `c4d23f10883a29c9353bac2e645b1434` 不一致（压缩时间戳/条目顺序），已存档到 `~/Downloads/ai-please-artifacts/ai-please-0.1.0-rebuilt-9449a07b.zip`，能回滚功能、不能保证字节一致；平台侧若要精确回退需重新上传。
3. 未执行的硬门禁：产品 non-goal 签字（m00002 起一直未拍板）、Chrome 61 真机、`verify:all` 全量（本轮只跑了 `tsc` + 单测 + build + 预算）。

## 10. 真机预览反馈：卡片没出现（2026-11-08 22:56）

用户实测 0.2.0 预览包：**能进、首页 footer 文案已是新版**（证明产物本身在容器里跑起来了），但结算页**没有排行榜卡片，也没有弹出任何授权询问**。

### 10.1 为什么「没有卡片」现在等于「不知道」

`degrade()` 把五类原因压成同一个 `hidden`：无 `window.xhs`、`xhs.miniTool` 缺方法、客户端版本 < 9.51、1005/1006 未授权、10003 白名单拒绝。用户可见结果完全一致，本地也没有控制台可读——**这是我们自己的可观测性缺口**，不是平台问题。不补监控就送审，等于盲发。

### 10.2 诊断包（一次性，不进送审）

- 构建期开关：`MINITOOL_RANK_DEBUG=1` 时 `vitest` 配置注入 `__RANK_DEBUG__ = true`，`src/debug/rankProbe.tsx` 在页面顶部渲染黑色自证面板；默认构建注入 `false`，整段被摇掉——实测 `grep "RANK DEBUG"` 在生产 `dist/` 与 `dist-minitool/` 均 **0 命中**。
- 面板逐条打印：`xhs` 是否存在、`miniTool` 的键、同步 `launchOptions`、异步 `getLaunchOptions()` 结果、算出的 `buildVersion`、`ver>=9510` 判定、`api` 是否齐全、`getMyRank` / `submitScore` 的原始返回或错误码（附 `mapError` 归类）。
- 本地用 Chrome + 桩容器验证过渲染：桩给 1005 → 面板显示 `getMyRank ERR {code:1005, kind:"unauthorized"}`，桩给 `getLaunchOptions` → `ver>=9510: PASS`。
- 诊断包：`red_app/B49xBoJuE-VyX-IPHynCW3soIRhtl0wJR90o-yVTwboSJ3c.zip`（45,776 B，5 文件，audit PASS），二维码 `minitool/preview-qr-8.png`。

### 10.3 顺带记一条打包陷阱

`vite build` 的 `emptyOutDir` 会清掉 `mini_tool.json`，**`write_manifest` 必须在 postprocess 之后重新跑**。漏跑时 `audit_artifact.mjs` 只报 `PASS: 4 file(s)` 而不报错——按文件数自查（应为 5：`index.html` / `mini_tool.json` / `assets/{app,compat,style}.{js,css}`）比看 PASS 更可靠。

## 11. 定因：1005 未授权（2026-11-08 23:00 真机截图）

诊断包在 iPhone（iOS，`env: develop`，预览 appId `6af08de1fae1a5001578ffb0`，客户端 `buildVersion=9530833` → 9.53.0）上的原始输出：

```text
xhs: yes
mtKeys: share,addCloudStorage,...,submitScore,getRankList,getMyRank,...,getLaunchOptions,...,version   （44 项，排行榜三件齐全）
syncLaunch: {"miniToolEnv":{"buildVersion":9530833,"interaction":"interactive","platform":"iOS","env":"develop","appId":"6af08de1..."},...}
buildVersion(sync): 9530000
ver>=9510: PASS
api: ok
getMyRank ERR: {"code":1005,"mapped":{"kind":"unauthorized"}}
submitScore ERR: {"code":1005,"mapped":{"kind":"unauthorized"}}
submitMapped: {"kind":"unauthorized","code":1005}
```

官方文档 §3.17「⚠️ 上传授权」原文：

> 使用 `submitScore` 的小工具，上传至创服平台时**必须勾选「用户头像昵称授权」**，榜单展示的用户昵称依赖该授权；未勾选时排行榜调用会按未授权失败处理（errCode 1005），应隐藏排行榜入口并降级。

结论：**卡片隐身是设计正确的降级，根因是上传时没勾授权**，不是代码、不是版本（9.53 ≫ 9.51）、也不是白名单（白名单会是 10003）。

### 11.1 由此暴露的流程约束

`redapp config` 的授权清单只有 `photos / camera / microphone / location`，**CLI 上传路径无法声明「用户头像昵称授权」**。所以 0.2.0 这一版必须走网页创服平台（<https://creator.xiaohongshu.com/new/red-app>）上传并勾选；CLI `submit` 链路在本特性上不可用——它能送审，但送出去的包永远拿不到昵称。

### 11.2 待验证

1. 勾选授权后是否仍会撞 10003 白名单（内测资格）——只有重新上传并再跑一次诊断包才能确认。
2. 网页上传会生成新的包 fileId，`minitool/submit.json` 里的 `pkgFileId/md5` 随之失效；若后续回到 CLI 送审，需要重新绑定。

### 11.3 送审用产物（已核对）

- `ai-please-minitool.zip`，44,888 B，md5 `e4024120971d4f25b5c16eef1866ef71`，5 文件（`index.html` / `mini_tool.json` / `assets/{app,compat,style}.{js,css}`）。
- 诊断代码确认不在包内：`unzip -p ai-please-minitool.zip assets/app.js | grep -c "RANK DEBUG"` → `0`。
