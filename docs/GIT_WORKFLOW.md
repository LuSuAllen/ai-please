# Git 工作流

> 一句话：**main 永远可发布，所有改动走 `feat/*` 分支，门禁全绿才合并。**
> 门禁只有一条命令：`npm run verify:all`。

## 1. 分支模型

主干开发 + 短生命周期特性分支（trunk-based），不额外维护 develop 分支——多一条长期分支就多一份漂移和一次合并冲突。

| 分支 | 用途 | 生命周期 |
| --- | --- | --- |
| `main` | 永远可发布；推上去即触发 `deploy.yml` 发布 Pages | 长期 |
| `feat/<slug>` | 新功能（例：`feat/rule-triage`） | 合并即删 |
| `fix/<slug>` | 缺陷修复（例：`fix/save-migration`） | 合并即删 |
| `chore/<slug>` / `docs/<slug>` | 工程、文档、依赖、CI | 合并即删 |

规则：

1. **不直接向 main 提交**。本地 `git switch -c feat/xxx`，远端同名分支，PR 合并。
2. 一个分支只做一件事；分支存活建议 ≤3 天，超过就拆。
3. 分支从最新 `main` 开出：`git switch main && git pull --ff-only && git switch -c feat/xxx`。
4. 分支内可随意 `rebase`/`amend`；**合并前禁止对 main 做 rebase 或 force push**。

## 2. 提交信息

Conventional Commits，scope 用模块名，中文正文：

```
feat(i18n): 操作词汉化 + 判定反馈重写，英文锚点常驻
fix(passport): 320 页脚折行导致的标签换行
docs(git): 增加 feat 分支流程与合并门禁
chore(ci): PR 上跑 verify:all
```

- 标题 ≤50 字，不加句号；正文写「为什么」和「验证方式」。
- 一个提交一个意图；重构与行为变更分开提交。

## 3. 合并门禁（唯一标准）

```bash
npm run verify:all
```

按序跑：`tsc --noEmit` + `vite build` + `postbuild` → 单测 61 条 → 预算门禁（首屏 JS ≤70kB、首屏 CSS ≤6.2kB、总产物 ≤260kB）→ 起 `dist` 静态服务器跑验收 20 场景 / 419 断言 → 双语探针（320/390 折行、溢出、遮挡）。

- 退出码 0 才算「测试无问题」，口头「我这儿好的」不算。
- CI 在 PR 上用同一条命令跑（`.github/workflows/ci.yml`），结果贴回 PR。
- 任何一项红：修分支，不要在 main 上试。

## 4. PR 与合并

1. 推送分支 → 开 PR（base `main`）→ CI `verify:all` 跑绿。
2. PR 描述写三段：**改了什么 / 为什么 / 证据**（门禁输出 + 关键截图路径）。
3. 合并方式：
   - 分支只有一条有效提交，或过程提交无保留价值 → **Squash and merge**（main 保持一条整洁提交，默认选这个）。
   - 分支内是多步可读的历史（重构 + 行为 + 文档分开提交）→ **Merge commit（--no-ff）**。
   - 不用 Rebase and merge（改写已在 CI 验过的对象，等价于换一个新提交再上生产）。
4. 合并后删除分支：`git branch -d feat/xxx` + `git push origin --delete feat/xxx`（GitHub 可设自动删）。
5. 合并进 main 即触发 Pages 发布；发布后按 `README.md` 的门禁段抽样线上（`verify:acceptance --url <线上地址>`）。

## 5. 分支保护（仓库设置）

`main` 应开启：

- Require a pull request before merging（审批数 0 即可，自审也留痕）
- Require status checks to pass → 勾选 `verify:all`
- Do not allow force pushes / deletions
- Enforce for administrators（可选：开了之后连管理员也必须走 PR）

> 保护一旦开启，任何「直接推 main」的路径（包括本机受限网络下的 Git Data API 兜底）都会被拒绝——这是设计意图：main 只接受经过 PR + CI 的改动。

## 6. 回滚与热修

| 场景 | 做法 |
| --- | --- |
| 刚合并的 PR 有问题 | `git revert -m 1 <merge-sha>` 开 `fix/rollback-xxx` 分支走 PR，不 force push |
| 线上静态资源异常 | 回退即重新发布：revert 后合并触发 deploy |
| 需要紧急修复 | `fix/<slug>` 分支 + `verify:all`，同样走 PR，不跳过门禁 |

## 7. 本机环境注意（这台机器）

- 可用的 git：`/Applications/Xcode.app/Contents/Developer/usr/bin/git`。`/usr/local/bin/git` 是 x86_64（`Bad CPU type in executable`），`/usr/bin/git` 撞 Xcode license。
- `github.com:443` 在本机网络下不可达（TCP/TLS 全超时），但 **`ssh.github.com:443` 可达**，仓库已按这条路配好：

  ```sshconfig
  # ~/.ssh/config
  Host github-ai-please
      HostName ssh.github.com
      Port 443
      User git
      IdentityFile ~/.ssh/ai_please_deploy
      IdentitiesOnly yes
  ```

  ```bash
  git remote -v
  # origin git@github-ai-please:LuSuAllen/ai-please.git (fetch/push)
  ```

  对应仓库 deploy key：「ai-please feat workflow (ssh 443 push)」，可写、仅此仓库。改名/换机时重新登记即可。

- 因此 `git fetch` / `git push` 直接可用，**不需要**额外环境变量。
- 备用路径（网络再次变化时）：Git Data API 推分支 —— blob → tree → commit → `PATCH /refs/heads/<branch>`（`force:false` + 父提交校验），脚本 `/tmp/push-api.mjs`，不含凭据。

## 8. 首次落地（本次）

```bash
git switch -c feat/git-workflow          # 从 main 开出
npm run verify:all                       # 本地门禁
# → PR → CI 绿 → Squash and merge → deploy.yml 发布
```
