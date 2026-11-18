# dsh-team-bot

面向 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原生多智能体群聊插件。

[English](README.md) | [简体中文](README.zh-CN.md)

> 状态：**0.18.0** — 独立任务验收（reviewer 不能是 owner）、验收/返工/人工批准状态、每任务独立工作目录与 artifact 校验、右侧栏停靠（聊天与控制台并排）、主/子 Bot 分开的回合预算与委派暂停、每个 Bot 独立模型路由（provider/model）、每个任务独立 Session、`team_bot_reset`、常驻主 Bot 指挥台、可追踪任务/步骤/产物、每个 Bot 的工具级实时活动与在线状态、Bot 间异步交接、破坏性操作人工审批、工具卡住检测与停止回合、共享本机 workspace、看门狗告警，以及原有的房间/记忆/手机 UI。从 GitHub 安装；npm 发布是可选项，暂未发布。

## 本机 workspace 与安全边界

这版可以把运行 DSH 的本机当作“执行节点”，但**不是**无限制的云电脑：

- Bot 的 Session 默认 cwd 是 `$DSH_HOME/dsh-team-bot/workspace`（可用 `workspaceRoot` 配置），团队共享该目录里的文件；
- 不在 workspace 内自动授予读写权限，仍受 DSH 的 sandbox/审批策略约束；
- Bot 不共享你的浏览器登录态；需要登录的网页操作要单独接浏览器工具或人工接手；
- 删除 Bot/房间/团队、外发消息、改生产数据等高风险动作应由主 Bot 先向你确认；
- 本机关机/休眠/DSH 退出时任务会停止，这不是 24×7 云主机；
- 不要在 workspace 里放 SSH key、token、客户隐私数据；prompt injection 可能诱导 Bot 读取/外发文件。

看门狗只负责发现“长时间没有新进展”，不会绕过审批替你执行危险操作。

## 从 0.12 迁移

- `state.json` 会在首次加载时自动补齐 `tasks / activities / presence / main` 字段，原有 bot、房间、消息和记忆保留；
- 首次打开面板时会自动创建 `主 Bot`（如果不存在），不会自动把它拉进已有房间；
- 需要重启 DSH 或重载插件让 Host 代码生效，然后强制刷新浏览器加载新面板；
- 任务 workspace 默认在 `$DSH_HOME/dsh-team-bot/workspace`，已有 bot 的 `workspace` 字段优先；
- 旧的房间群聊仍可用，新的指挥台是默认入口。

## 为什么做这个

DSH 已经有单 Agent、子 Agent，以及实验性的 Agent Teams 运行时。但它缺少一个**共享房间**：人和多个有名字的 Bot 在同一个时间线里说话，有一个总管负责拆活，有一份不随单个 Session 消失的群笔记，还有属于房间而不是某个 Session 的记忆。

`dsh-team-bot` 就是这一层。它是一个普通的 DSH 插件 bundle：增加 Host 服务、模型工具和 Web 客户端；不 fork、不修改 DSH。

## 产品形态

- **共享房间** — 人类和多个 Bot 共用一条时间线；支持 `@`、总管路由、自动路由。
- **总管台 + 私聊** — 总管有自己的 Session，可以把结论带回群里，也可以把活拆给成员。
- **记忆** — 群共享记忆（L0 原始消息 → L1 事实 → L2 摘要 → L3 画像）加每个 Bot 的私有记忆。
- **真实 Session** — 每个 Bot 背后都是一个真实的 DSH Session，因此工具、审批、流式输出、搜索、模型选择都是继承来的，不是重写的。
- **一句话建队** — 描述目标（「我要做一个短视频团队」），插件自动创建角色、主群，以及带各自总管的分组。

### 一句话建队

`team_compose({ brief })` 会匹配内置模板，一次创建完整团队：

```text
短视频团队 → 总导演 / 制片 / 编剧 / 前期导演 / 后期导演 / 剪辑师 / 声音设计 / 视觉设计
            主群 + 前期组（编剧、前期导演、制片，chief 前期导演）
                 + 后期组（后期导演、剪辑师、声音设计、视觉设计，chief 后期导演）
软件项目团队 → 项目经理 / 产品经理 / UI/UX 设计 / 前端 / 后端 / 测试
            主群 + 产品组 / 开发组 / 测试组
```

`team_template_list` 列出模板；`team_room_update` 可以改成员，或把同一个总管嫁接到另一个群。

需求没匹配到模板时，隐藏的 **团队架构师** Session 会把它拆成经过校验的 JSON 角色表；生成失败则回退到通用三人组，不会卡死。

每个 Bot 和房间都有确定性的 `{hue, variant}` 头像，面板用 SVG 渐变脸绘制。面板的 **AI 建队** 按钮调用同一个 `POST /compose`。

## 目录结构

```text
src/host/
  index.js      插件入口、数据目录、runtime、工具、路由
  store.js      房间、Bot、消息、记忆文档与持久化
  routing.js    mention / admin / auto 路由
  runtime.js    真实 Session：创建/恢复、prompt、等待 turn/end
  actions.js    共享的“发消息 + 跑被路由 Bot + 捕获记忆”动作
  routes.js     /dsh-team-bot/api/*，供 Web 面板使用
  memory.js     L1 原子、L2 抽取式摘要、L3 画像、BM25-lite 召回
  tools.js      team_* 模型工具
lib/client.js   左侧栏入口 + 主面板 + 设置页「团队群组」
test/           store、routing、runtime、memory、client-bundle 测试
```

## 工具

| 工具 | 用途 |
|---|---|
| `team_bot_create` | 创建具名 Bot 画像（角色、人设、模型、workspace） |
| `team_bot_update` | 修改已有 Bot 的名称、角色、人设、模型或 workspace |
| `team_bot_reset` | 清空某个 Bot 的房间 Session 和全部任务 Session（画像/模型/workspace 不动） |
| `team_bot_list` | 列出画像及绑定的 Session id |
| `team_task_create` | 创建任务，可带验收标准、独立 reviewer、人工审批标记 |
| `team_task_assign` | 派发任务；自动创建该任务的独立工作目录并在独立 Session 中执行 |
| `team_task_handoff` | 把任务异步交接给另一个 Bot |
| `team_task_report` | 上报进行中/阻塞/失败；不能用来直接完成 |
| `team_task_submit_review` | owner 注册 artifact 后提交独立验收 |
| `team_task_review` | reviewer 通过/退回/拒绝；退回会自动唤醒 owner 返工 |
| `team_task_update` | 更新状态、进度、owner、reviewer、验收标准 |
| `team_task_artifact` | 登记任务目录内真实存在的交付文件 |
| `team_task_list` / `team_task_get` | 读取任务、步骤和产物 |
| `team_task_delete` | 删除任务（需要人工审批） |
| `team_compose` | 一句话创建整个团队：Bot、主群、分组 |
| `team_template_list` | 列出内置团队模板 |
| `team_room_create` | 创建房间，指定成员、总管、回复策略 |
| `team_room_update` | 修改成员/总管/策略，或把总管嫁接到其他群 |
| `team_rename` | 重命名团队及其主群 |
| `team_room_list` | 列出房间 |
| `team_room_post` | 追加一条消息并返回被路由的 Bot（只写存储） |
| `team_room_ask` | 追加人类消息，把被路由的 Bot 作为真实 turn 执行，并回写回复 |
| `team_room_history` | 读取最近消息 |
| `team_room_memory` | 读取共享记忆和指定 Bot 的私有记忆 |
| `team_memory_remember` | 新增/覆盖一条共享或私有事实 |
| `team_memory_forget` | 按 id 删除一条原子 |
| `team_memory_persona` | 给 Bot 增加一条 L3 常驻偏好 |
| `team_memory_review` | 接受 / 拒绝 / 重新打开一条原子 |
| `team_dm_ask` | 与某个 Bot 进行一轮私聊 |
| `team_dm_history` | 读取私聊记录 |
| `team_dm_list` | 列出私聊会话 |
| `team_chief_desk` | 与房间总管对话，并带上总管角色上下文 |

### 独立验收与任务工作目录

任务不再允许 owner 自己标完成：

```text
queued → running → in_review → done
                    ↘ changes (最多 3 轮) → blocked
                    ↘ needs_approval → 人工批准 → done
```

- `team_task_create` 可填 `acceptance_criteria`、`reviewer_bot_id`、`needs_approval`；
- owner 用 `team_task_artifact` 登记真实文件，再用 `team_task_submit_review` 提交；
- reviewer 不能是 owner，用 `team_task_review` 给出 `approve / changes / reject`；
- 退回会自动唤醒 owner 返工；3 次不通过 → `blocked`；
- `needs_approval` 的任务在面板里由人「批准完成 / 拒绝返工」；
- 每个任务在 `workspace/tasks/<task-id>/` 下独立运行，任务 Session 的 cwd 指向该目录；artifact 不能越界，文件必须真实存在。

### 每个 Bot 用不同模型

Bot 画像的 `model` 是 `provider/model`（例如 `openai/gpt-6.1-sol`、`qwen/qwen3-max`）。Runtime 建好该 Bot 的真实 Session 后会调用 `sessionController.selectModel`，因此房间、私聊和任务 Session 都跑在这条路由上；改画像后下一轮生效，删空则回到部署默认模型。provider 路由在 DSH 的 **设置 → 模型** 里配置（`llm-pi-ai` 的自定义模型 API）；没配的路由会直接报 `cannot use model`，不会悄悄回退。

面板的 Bot 抽屉里可以直接填模型，输入框会带出 `/dsh-team-bot/api/models` 返回的当前模型目录；Bot 列表也会显示每个 Bot 的模型。

### 会话与超时

- **房间/私聊**共用一个长期 Session，适合连续讨论同一个项目。
- **每个任务一个 Session**：`team_task_assign`、`team_handoff`、面板任务都按 `taskId` 记住自己的 Session。第二次审查是另一个任务，会自动从干净上下文开始，不会锚在上一轮的结论上；同一个任务重跑才复用原 Session。每个 Bot 最多保留 30 个任务 Session。
- **`team_bot_reset`**：需要彻底重来时清空该 Bot 的房间和任务 Session，画像、模型、workspace 不变。
- **主 Bot 与子 Bot 分开配置**：`timeoutMs`（默认 `900000`）管子 Bot，`mainTimeoutMs`（默认 `1800000`）管主 Bot。
- **委派暂停**：主 Bot 调用 `team_task_assign`、`team_handoff`、`team_room_ask`、`team_dm_ask`、`team_chief_desk`、`team_compose` 期间，自己的计时器会暂停，子 Bot 返回后再续上。所以 20 分钟的审查不会被主 Bot 的 15 分钟预算掐断，你也不用判断任务长短。
- 面板的 HTTP 请求按 `max(timeoutMs, mainTimeoutMs) + 60s` 等待。

```yaml
- id: team-bot
  config:
    timeoutMs: 900000        # 子 Bot 单轮预算
    mainTimeoutMs: 1800000   # 主 Bot 单轮预算
```

### 一轮消息怎么走

1. `team_room_ask` 写入人类消息，拿到 `routed`。
2. 路由：显式 `@` 优先；`admin` 交给总管；`auto` 用消息 token 与每个 Bot 的 name/role/persona 打分，全 0 分时回退到前 `maxSpeakers` 个成员。
3. 对每个被路由的 Bot：首次 `sessionController.create`，之后 `resolveAgent`，然后 `prompt`，上下文带 Bot 人设、房间名和最近 12 条消息。
4. runtime 轮询 Session 日志里的 `turn/end`，取最后一条 `assistant/message` 文本，以该 Bot 身份回写房间。
5. `[PASS]` 和空回复会跳过。每个 Bot 的调用串行；工具会等整批路由跑完。

Bot 画像会持久化 `sessionId`，所以下一条房间消息会继续同一个会话，也就是同一个 DSH Session。

### 记忆

- **L0** — 追加式房间 JSONL 是唯一事实来源。
- **团队** — 同一个 `teamId` 下的房间共享 `memory/team/<teamId>.json`；团队事实会先于房间事实注入，所以前期组和后期组看到的是同一套团队规范。团队摘要会在每次 ask 后从团队内所有房间的最近消息重建。
- **L1** — 原子 `{key, text, importance, review}`。同 `key` 覆盖；近重复（Jaccard ≥ 0.8）跳过；按 importance 上限 40 条。
- **L2** — 最近 8 条消息的抽取式摘要，每次 `ask` 后刷新。
- **L3** — 每个 Bot 的常驻偏好（`team_memory_persona`），上限 12 条。
- **捕获** — 人类消息包含 记住 / 以后 / 决定 / 规则是 / 不要 / 必须 / 约定 时生成原子：「记住」直接 accepted，其余为 pending 待审。
- **召回** — 中文 bigram + 英文词，token 重叠加 importance 先验；最多 4 条共享 + 4 条私有原子，与摘要一起注入 Bot prompt。只有 **accepted** 原子会被召回。
- **审核** — 非「记住」的自动捕获保持 `pending`；`team_memory_review` 和面板抽屉可以接受、拒绝或重新打开。拒绝的原子保留为墓碑，但永不进入 prompt。
- **写入路径** — 模型工具（`team_memory_*`）、面板抽屉，以及 `POST` / `DELETE /rooms/:id/memory`、`POST /rooms/:id/memory/review`。
- **限制** — 目前是确定性抽取，不是 LLM 摘要；LLM 抽取留待后续。

### 私聊与总管台

- 每个 Bot 可以有 1:1 会话，存在 `messages/dm-<botId>.jsonl`；它和房间 turn 共用同一个真实 Session，因此上下文和每 Bot 串行队列是共享的。
- `team_dm_ask` 用 Bot 人设、私有原子和私有摘要跑一轮私聊。
- `team_chief_desk` 解析房间 chief，并注入“你是本房间总管，可用 `team_room_post` 把结论发回群”的提示。
- 路由：`GET /dms`、`GET /dms/:id/messages`、`POST /dms/:id/ask`。

### Web 面板

点击左侧栏 **团队群组**，或打开 **设置 → 团队群组**。房间按团队分组，可折叠，也可用搜索框过滤；页面包含成员 chips、带 Bot 头像的时间线、输入框（输入 `@` 可直接选成员）、带 Bot 搜索的建房表单，以及房间/团队双 tab 的记忆抽屉。**管理** 可以改成员和总管、重命名团队，也可以删除房间或整个团队（带确认）。

面板右上角的 **并排** 按钮会把控制台停靠到会话的 **右侧栏**，和聊天同时显示（右侧栏宽度可拖）；右侧栏的「+」引导页里也有 **团队群组** 一项。右侧栏只在有会话时存在，停靠后用的是紧凑布局。

手机窄屏（小于 720px）下，房间列表变成带遮罩的抽屉，聊天占满宽度，顶部按钮自动换行，记忆/管理/AI 建队/新建房间变成底部弹层；输入框会避开 iPhone 底部安全区。

面板使用的路由：`health`、`state`、`client`、`templates`、`compose`、`rooms`（POST）、`rooms/:id`（PATCH/DELETE）、`rooms/:id/messages`、`rooms/:id/ask`、`rooms/:id/memory`、`rooms/:id/memory/review`、`teams/:teamId`（PATCH/DELETE）、`teams/:teamId/memory`、`teams/:teamId/memory/review`、`dms`。

如果包是在 Host 启动后才新增 `dsh.client`，客户端模块图需要一次 **Harness 重启** 才会收录；之后启用/禁用插件行即可。

## 数据模型

```text
$DSH_HOME/dsh-team-bot/
  state.json                 # version, seq, bots, rooms, directs
  messages/<roomId>.jsonl    # 追加式房间时间线
  messages/dm-<botId>.jsonl  # 追加式私聊时间线
  memory/room/<roomId>.json  # 共享记忆
  memory/team/<teamId>.json  # 团队级共享记忆
  memory/bot/<botId>.json    # 每 Bot 私有记忆
```

房间策略：

```json
{
  "replyMode": "mention | admin | auto",
  "maxSpeakers": 3,
  "hopLimit": 2,
  "allowPass": true
}
```

## 安装

从 GitHub 安装（npm 暂未发布，推荐）：

```bash
dsh plugin --profile web add github:CoderMrYan/dsh-team-bot
```

从本地 checkout 安装：

```bash
dsh plugin --profile web add D:\applications\dsh\dsh-team-bot
```

也可以在插件页面用 `plugin_manager install_bundle` 安装目录。Host 部分（工具、路由、记忆）立即生效；Web 客户端部分在包首次获得 `dsh.client` 后需要一次 Harness 重启才会挂载。

已验证的打包方式：

- `npm install github:CoderMrYan/dsh-team-bot` → `added 1 package`（client、host、locale 文件齐全）
- `npm pack` → 17 个文件，约 22 kB（LICENSE / README / CHANGELOG / client / host / locale）
- `npm install <tarball>` → `added 1 package`
- `npm publish --dry-run` → 通过（public，未真正发布）
- 客户端 bundle：注册冒烟 + React SSR 渲染（标题和空态，约 1.5 kB HTML）

配置：

```yaml
- id: team-bot
  config:
    dataDir: ''   # 默认 $DSH_HOME/dsh-team-bot
```

## 开发

```bash
node --test test/store.test.js test/runtime.test.js test/memory.test.js test/direct.test.js test/client.test.js
node --check src/host/index.js
```

本仓库是一个 DSH bundle。用 `plugin_manager install_bundle`（或 `dsh plugin add`）安装目录后，它会显示为一个插件行。

## 路线图

- [x] P0 房间存储、路由、工具、测试
- [x] P1 真实 Session 运行时：每 Bot 一个 Session，prompt，等待 `turn/end`，回写回复，每 Bot 串行
- [x] P2 Web 面板：房间列表、时间线、输入框、成员 chips、建房（客户端部分需重启一次挂载）
- [x] P3 记忆 MVP：L1 原子、L2 抽取式摘要、L3 画像、BM25-lite 召回、显式捕获、工具与 API
- [x] P3.5 私聊与总管台：每 Bot DM 时间线、DM runtime、总管角色提示、`/dms` API
- [x] P3.6 记忆审核队列与面板抽屉：pending 不进入 prompt，接受/拒绝，增删，摘要
- [x] P4 打包与 CI：npm 元数据、peer deps、CHANGELOG、GitHub Actions
- [x] P5 GitHub 发布路径：SSH 推送完成；`dsh plugin add github:CoderMrYan/dsh-team-bot` 已验证
- [x] P6 一句话建队：团队模板、分组、总管嫁接、确定性头像、面板 AI 建队
- [x] P7 UX：房间按团队分组、成员/总管管理、时间线头像、自动滚动、更多头像样式
- [x] P8 生命周期：删除房间/团队、确认、时间线与记忆清理
- [x] P9 团队级记忆：团队内所有房间共享事实，面板双 tab，工具与 API
- [x] P10 团队身份：重命名、自动团队摘要、点击房间行的焦点框修复
- [ ] npm publish（可选，暂缓）

## 设计参考

- [dsh-bot](https://github.com/lisongjianustc/dsh-bot) — 真实 Session Bot、群转发、maxSpeakers、群笔记
- [dsh-team-workbench](https://github.com/narkco-kang/dsh-team-workbench) — L0–L3 记忆、部门即 Agent、面板模式
- [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) — 注意力预算与授权哲学

这些只作为思路参考；本仓库没有复制它们的代码。

## 许可证

MIT。
