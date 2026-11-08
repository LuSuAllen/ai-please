# 小红书小工具 · 0.1.0 上架记录与换机接手

> 状态：**已发布**（`redapp list` 2026-11-08 21:34 → `status=2` 已发布，`version=0.1.0`，`gmtUpdate=2026-11-07 23:28:23`）。本文档记录的是送审当时的输入；平台侧已过审上线。
> 记录时间：2026-11-07 23:22（Asia/Shanghai）
> 本文件是「换一台电脑继续」的唯一入口：环境怎么装、包怎么打、审到哪一步、坑在哪。

---

## 1. 上线身份

| 字段 | 值 |
| --- | --- |
| appId | `6aef424dfae1a5001578fb19` |
| 名称 / 简介 | AI, PLEASE / 边境审核模拟器 |
| 版本 | `0.1.0`（首版刻意用 0.x；真机验证过再谈 1.0.0） |
| 分类 | `casual_game`（休闲游戏） |
| 平台授权 | 无（只用 localStorage，未申请相册/相机/麦克风/位置） |
| 提交时间 | 2026-11-07 23:22:53 |
| 审核状态 | `status=1` · 审核中 |
| 产物 | `ai-please-minitool.zip` · 42,650 B · 5 个文件 |
| pkgFileId | `red_app/4U85AZsYPq_dEuDQeDR7XeMmWQ_cA0G37-kMwUanbTp8T6c.zip` |
| pkg md5 | `c4d23f10883a29c9353bac2e645b1434` |
| iconFileId | `red_skill_tool_image/LQv1wLKxboOzmYCH9NGocOe7QI01vvR9KK1wXsqcxPsWFzE.png`（`docs/brand/ai-please-icon-1024.png`，sha256 `e22d0e2f…`，与平台存储字节一致） |
| coverFileId | `red_skill_tool_image/ARUQouEvLbt7zwLzA9okBLlyjz1kkiCd6EKahhBWsnaJkYo.png`（`docs/brand/ai-please-cover-1152x1536.png`，sha256 `dc120e26…`） |

查状态（两行任一即可）：

```bash
redapp status --source thirdAgent --app-id 6aef424dfae1a5001578fb19 --agent
redapp list   --source thirdAgent --agent
```

---

## 2. 换机接手：环境三步

### 2.1 仓库与依赖

```bash
git clone git@github.com:LuSuAllen/ai-please.git
cd ai-please && npm install
npm run verify:all      # 唯一门禁：tsc + build + 61 单测 + 预算 + 20 场景验收 + 双语探针
```

### 2.2 两个 Skill（不走仓库，装在用户级技能目录）

| Skill | 来源 | 本机落点 |
| --- | --- | --- |
| `redapp-cli` | `https://fe-video-qc.xhscdn.com/fe-platform-file/104101b8326rqruuj5006b6titltg00000000038l066g4` | `~/.dsh/skills/redapp-cli/` |
| `minitool-zip-builder` | `https://fe-static.xhscdn.com/minitool/test/20261023/dist/minitool-zip-builder-1.9.0-beta.20261023.1.skill` | `~/.dsh/skills/minitool-zip-builder/` |

下载到临时目录 → 校验是否 ZIP → 拒绝绝对路径/`..`/软链接，跳过 `__MACOSX`、`._*` 后解压；`redapp-cli` 必须保持 `redapp-cli/SKILL.md` 这一层，不能多套一层。

### 2.3 CLI 门禁（每次新会话先跑）

npm 只用进程级 prefix/cache，不动全局配置：

```bash
export PFX="$HOME/.cache/dsh-redapp-cli/npm-prefix"
env PATH="$PFX/bin:$PATH" \
    npm_config_prefix="$PFX" \
    npm_config_cache="$HOME/.cache/dsh-redapp-cli/npm-cache" \
    node "$HOME/.dsh/skills/redapp-cli/scripts/ensure-cli.mjs"
# 输出 CLI_VERSION_JSON.status ∈ {current, installed, updated} 才算可用
```

首次登录（凭证只在本机，**不随仓库同步**）：

```bash
"$PFX/bin/redapp" login --agent     # 打印 PROMPT + 二维码
```

- 二维码 payload 是 `xhsdiscover://…` 深链，**只能小红书 App 扫码**，桌面浏览器打开是空白页
- 页面提示「AI 助手的终端授权码」时，填 PROMPT 里的 `userCode`（形如 `GTMK-ATEW`）
- 凭证落盘 `~/.skillhub-upload/credentials.json`（600），access 约 2 小时、refresh 约半年自动续期

---

## 3. 打包链路（可复现）

```bash
# 1) 构建小工具产物（相对路径 + classic IIFE + ES2017 目标）
npx vite build --config minitool/vite.minitool.config.mjs

# 2) 后处理：去 module/crossorigin、补 defer、CSS 老内核回退、flex-gap 探测
node minitool/postprocess.mjs

# 3) 写高消耗标记（本游戏无 Worker/WASM/引擎 → false）
node ~/.dsh/skills/minitool-zip-builder/scripts/write_manifest.mjs dist-minitool false

# 4) 审计目录 → 在产物目录内打包 → 审计 zip
node ~/.dsh/skills/minitool-zip-builder/scripts/audit_artifact.mjs dist-minitool
(cd dist-minitool && zip -rX ../ai-please-minitool.zip . -x '*.DS_Store')
node ~/.dsh/skills/minitool-zip-builder/scripts/audit_artifact.mjs ai-please-minitool.zip
```

产物结构（`index.html` 必须在根）：

```
index.html
assets/app.js        # 单文件 IIFE，无 import/export、无 eval、无内联脚本
assets/style.css     # 已回退 env()/min()/max()/clamp()/dvh/gap
assets/compat.js     # 实测 flex gap 是否可用，不支持才给 <html> 加 no-flex-gap
mini_tool.json       # {"is_high_consumption_scene":false}
```

上传与送审：

```bash
redapp upload --file ai-please-minitool.zip --type pkg --agent --dry-run   # 读 plan.planHash
redapp upload --file ai-please-minitool.zip --type pkg --agent --confirm "<planHash>"
redapp submit --source thirdAgent --file ./minitool/submit.json --dry-run --agent
redapp submit --source thirdAgent --file ./minitool/submit.json --confirm "<planHash>" --agent
```

`minitool/submit.json` 是可入库的提交载荷（名称/简介/icon/cover/version/pkgFileId/md5/分类/授权）；**素材 fileId 与 pkg fileId 属于平台侧对象，换机后仍有效**，只有重新打包含义上的新 md5 才需要重新 upload。

---

## 4. 全屏留白为什么是固定 104 / 56

小工具全屏时 **webview 从屏幕最顶部开始渲染**，系统状态栏（约 32–59px）和容器自带导航条（返回 / 分享 / 更多，约 44px）都浮在网页上方；容器里 `env(safe-area-inset-*)` 取到的是 0，靠它留白必然被压住。

**留白只注入小工具产物，网页版保持原样**：`src/styles/global.css` 仍用 `env(safe-area-inset-*)`（浏览器里是对的），
`minitool/postprocess.mjs` 在产物 CSS 末尾追加覆盖段：

```css
:root{--pad-top:104px;--pad-bottom:56px}
.statusbar{padding:var(--pad-top) var(--pad) 10px}
.actionbar{padding:9px var(--pad) var(--pad-bottom)}
.storage-warning{top:var(--pad-top)}
.sheet-foot{padding:10px 11px 12px}
.drawer .sheet-foot{padding-bottom:var(--pad-bottom)}
.home{padding:calc(var(--pad-top) + 14px) 18px calc(var(--pad-bottom) + 14px)}
.result{padding:calc(var(--pad-top) + 10px) var(--pad) calc(var(--pad-bottom) + 10px)}
.toast-wrap{top:calc(var(--pad-top) + 108px)}
```

- 固定常量（不是 `env()`/`max()`），Chrome 61 直接可用，后处理无需再回退
- 网页版产物与改动前字节一致（`dist/assets/index-C3gikYer.css` 哈希未变），不会给官网带来 104px 空档
- 送审的 0.1.0 包是更早一版「直接写进 `:root`」的产物，**视觉等价、字节不同**；0.1.1 起以本链路为准

官方本地模拟器复现命令（能同时看到状态栏与容器导航条，是本轮唯一可信的验收方式）：

```bash
redapp dev --dir ./dist-minitool --no-open     # 工作台 http://127.0.0.1:53976/
```

---

## 5. 本轮踩过的坑（照抄能省两小时）

| 坑 | 现象 | 处理 |
| --- | --- | --- |
| `env()` 在容器里恒为 0 | 顶部只留 8px，内容压在状态栏下 | 改固定常量；别信纸面推算，进模拟器量 |
| 用错验证工具 | 浏览器直开 `file://` 看不出容器导航条遮挡 | 只认 `redapp dev` 的真机壳 + 真机 |
| `vite build` 的 `emptyOutDir` | 重建后 `dist-minitool/mini_tool.json` 被清掉，zip 少一个文件 | 每次 build 后重跑 `write_manifest.mjs`，再审计 |
| classic 脚本不延迟 | 去掉 `type="module"` 后 app.js 在 `#root` 之前执行，白屏 | 后处理里补 `defer`（module 本来就天然延迟） |
| 后处理只 clone 不回写 | `Error: CSS: 现代函数残留` | 单条 pipeline：计算最终值后 `decl.value = v` |
| 二维码打不开 | `xhsdiscover://` 深链，桌面浏览器必空白 | 只给 App 扫；聊天自动链接会截断 `&` 参数，发图不发链接 |
| 送审门禁 | 用户口头「可以送审」不算 | 必须用户扫码预览后明确说「预览通过，可以送审」 |

---

## 6. 未完成 / 下一步

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 审核结果 | ⬜ 等待 | `status=1`；被拒会有 `rejectReason`，改完重新 `submit` |
| Android 真机 | ⬜ 未测 | 重点看三键导航/手势条，顶部留白是否足够 |
| iOS 真机 | ⬜ 未测 | 重点看灵动岛机型（安全区 59px）与返回条 |
| 合规文案 | ✅ | 首页常驻「本作为虚构世界观 · 无后端 / 无 API / 可离线」，无平台授权项 |
| 版本策略 | 待定 | 审核通过 + 真机无问题后再升 1.0.0 |
