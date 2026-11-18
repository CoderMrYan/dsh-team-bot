# Changelog

## 0.23.0 — 2026-11-18

### Fixed

- **Opening 团队群组 from the left sidebar no longer replaces the conversation.** The left entry now mounts a launcher: when a Session is on screen and the right column is available, it restores the `conversation` main panel first and then opens the team tab in the right sidebar, so chat and team console stay side by side.
- Without an active Session the launcher falls back to the full console, because the right column has no Session surface to dock into.
- The right-sidebar guide entry and the console 「并排」 button remain available.

## 0.22.0 — 2026-11-18

### Changed

- High-risk tasks (`publish`, `merge`, `spend`, `external`) now enter `needs_approval` **before execution** when the Team Card policy is `human`. The scheduler and synchronous assignment refuse to start them; the panel offers 「批准执行」/「拒绝执行」. After approval the task is re-queued, then follows the normal independent review flow.
- `approveTask` distinguishes pre-execution approval (`approvalStage: pre`) from post-review completion; `rejectTask` blocks a pre-execution rejection.
- `updateTask` and `assignTask` reject attempts to bypass pre-execution approval, so a model cannot move the task to running itself.

## 0.21.0 — 2026-11-18

### Added

- **Read-only reviewer sessions**: when a task is submitted, the reviewer's task Session gets `tools.restrict({ allow })` for the duration of that turn. Only read/glob/grep/web search/fetch, task reads, brief, Team Card reads and `team_task_review` remain; `write`, `edit`, `pwsh`, artifact registration and memory mutations are hidden. The restriction is fail-closed when the DSH composition cannot apply it.
- **Forced high-risk approval**: task kinds `publish`, `merge`, `spend` and `external` now force `needs_approval` when the Team Card policy says `human` (default). The model cannot clear that flag, and `done` still requires both review approval and human approval.
- `team_task_create` accepts `kind`; task prompts and the panel show the risk kind and approval state.

## 0.20.0 — 2026-11-18

### Added

- **Team Cards**: durable per-team lead/reviewer/publisher, shared rules, shared skills and human-approval policy (`team_card_get`, `team_card_update`, `GET/PATCH /team-cards`). `team_compose` creates one automatically.
- **Layered context**: room, task and private prompts now receive the Team Card rules, shared skills, reviewer/publisher and approval policy; bot profiles gain role `skills`, included in every prompt.
- **Token and wake accounting**: assistant-step usage is accumulated per task; the task drawer shows tokens and wake count.
- **Team brief + heartbeat**: deterministic `team_brief` / `GET /brief` report; a token-free heartbeat records stale tasks and posts a daily Main Bot brief. Configurable with `heartbeatMs` and `dailyBriefHour`.
- **Task cancellation**: `team_task_cancel` and `POST /tasks/:id/cancel` remove queued work or cancel the running task Session; panel adds an inline cancel button.

### Changed

- New tasks for a team automatically use the Team Card reviewer when none is passed.
- `team_bot_create` / `team_bot_update` and the Bot drawer accept role skills.

## 0.19.0 — 2026-11-18

### Added

- **Background task dispatch**: `team_task_dispatch` enqueues a durable task and returns immediately, so the Main Bot can keep coordinating while a worker turn runs.
- **Task scheduler** with global `maxConcurrentTasks` (default 2): extra tasks stay `queued`, start automatically when a slot frees, and are re-enqueued after a plugin reload.
- **Queue observability**: queue entry steps, waiting presence, background-finished activity and a Main Bot notification.
- `POST /tasks/:id/dispatch` for the same behavior from the panel/API.

### Changed

- `team_handoff`, reviewer-driven rework and the human-reject path now go through the scheduler instead of starting unbounded background turns.
- Main Bot operating rules use `team_task_dispatch` for normal work; `team_task_assign` remains the deliberately synchronous path.

## 0.18.1 — 2026-11-18

### Fixed

- Tool calls now verify the calling DSH Session against `bot_id` / `reviewer_bot_id`, so a bot cannot submit or approve a task under another bot's identity.
- The tool-approval bridge recognizes per-task Session ids in `bot.taskSessions`, not only the legacy single task Session field.

## 0.18.0 — 2026-11-18

### Added

- **Independent task review**: new `in_review` and `needs_approval` states, `acceptance_criteria`, `reviewer_bot_id`, `review_attempts`, review notes and reviewer metadata. Owners cannot review their own tasks; three failed rounds block the task.
- **`team_task_submit_review` and `team_task_review`**: the owner registers artifacts and submits; the reviewer approves, requests changes, or rejects. Changes automatically wake the owner for rework.
- **Per-task isolated workspaces**: `workspace/tasks/<task-id>` is created on assignment and passed as the task Session cwd. `team_task_artifact` now rejects paths outside it and requires the file to exist.
- **Human approval gate**: reviewed tasks marked `needs_approval` wait for the panel's 「批准完成 / 拒绝返工」 action; direct `done` is rejected until review and required approval pass.
- Panel task detail shows acceptance criteria, reviewer, review state, rework count, review notes and workspace, with human approval buttons.

### Changed

- `team_task_create` accepts `acceptance_criteria`, `reviewer_bot_id` and `needs_approval`; `team_task_update` accepts the review fields but cannot bypass the done gate.
- Main/task prompts now require `team_task_submit_review` instead of self-marking done.

## 0.17.0 — 2026-11-17

### Added

- **Right-sidebar tab**: the team console can now dock in the conversation's right sidebar as a `team-bot` tab, so chat and the console are visible side by side. The console header gains a 「并排」 button (shown when the right sidebar is mounted and a Session is on screen), and the right sidebar's add-guide lists 「团队群组」. The docked body renders the same console in compact layout.
- The client plugin now injects `sidebarRight` and `sidebarRightTabs`, which the standard web shell mounts.

## 0.16.0 — 2026-11-17

### Added

- **Separate budgets for the Main Bot and sub-bots**: `timeoutMs` (default `900000`) applies to sub-bot turns and `mainTimeoutMs` (default `1800000`) to the Main Bot. Configure both under `dsh-team-bot` in the profile's `cordis.patch.yml`.
- **Delegation pause**: while a `team_task_assign`, `team_handoff`, `team_room_ask`, `team_dm_ask`, `team_chief_desk` or `team_compose` tool call is in flight, the calling turn's timer is paused and re-armed when the child returns. A 20-minute review no longer gets killed by the parent's 15-minute budget.

### Changed

- Panel HTTP asks wait for `max(timeoutMs, mainTimeoutMs) + 60s`.
- Turn timeouts are now driven by a per-turn `AbortController`, so the same timer both cancels the Session and ends the wait.

## 0.15.0 — 2026-11-17

### Added

- **Per-task Sessions**: every durable task now runs in its own Session (`bot.taskSessions[taskId]`), reused only when the same task runs again. Room and private chats keep their long-lived Session. A second review task therefore starts from a clean context instead of anchoring on the first task's answer. Up to 30 task Sessions are kept per bot.
- `team_bot_reset` tool and `POST /dsh-team-bot/api/bots/:id/reset`: forget a bot's room Session and all task Sessions without touching its profile, model or workspace.
- Config `timeoutMs` (default `900000`, minimum `60000`): per-turn wall-clock budget for every bot turn, including reviews. Panel HTTP asks now wait `timeoutMs + 60s`.

### Changed

- Default turn timeout raised from 3 to 15 minutes; HTTP ask routes no longer cap at 5 minutes.

## 0.14.0 — 2026-11-16

### Added

- **Per-bot model routing**: a profile's `model` setting (`provider/model`, for example `openai/gpt-6.1-sol`) now binds to that bot's real Session through `sessionController.selectModel`, for room/private turns and workspace task Sessions alike. Changing the setting re-applies on the next turn; a missing provider route fails loudly with `bot <name>: cannot use model ...` instead of silently falling back to the deployment default.
- `team_bot_update` tool: change name, role, persona, model or workspace of an existing bot. An empty `model` clears the route back to the deployment default.
- `GET /dsh-team-bot/api/models` exposes the live model catalog as flat `provider/model` refs, plus the deployment default and per-provider failures.
- Bot drawer: model input with a catalog-backed datalist; the roster and drawer show the effective model.

### Changed

- `team_bot_create` validates `model` as `provider/model`; `PATCH /bots/:id` accepts `model`.
- New test file `test/model.test.js` covers route parsing, one-time binding, re-binding on change, and provider failures.

## 0.13.7 — 2026-11-10

### Added

- **Stop Main Bot** button in the command center whenever the Main Bot is `thinking`, `tool` or `waiting`; `POST /main/cancel` cancels the live session and clears presence.
- **Tool-stall detection**: a tool call with no event for 60 seconds flips the bot to `waiting` with “工具长时间未返回，可能在等待授权”; the user can stop the turn instead of waiting forever.
- **Tool approval bridge** for DSH `approval/request` (best effort): team-owned sessions create a pending approval card and the decision is sent back as `allowed-once`/`rejected`.
- **Tool failure detail**: `tool/result` error text is now written to activity and task steps, so “approval … cancelled” is visible rather than an empty “工具失败”.

### Fixed

- Runtime turn timeout explicitly cancels the Session and clears a stale `thinking` presence.
- Main/task prompts now forbid `danger-full-access`, require a blocked report when approval is unavailable, and forbid retrying the same cancelled approval.

## 0.13.6 — 2026-11-10

### Fixed

- **Delete Bot appeared to do nothing**: `window.confirm` could be suppressed by the host, and API errors were rendered behind the drawer. Deletion now uses an inline two-step confirmation (`删除 Bot` → `确认删除`) and shows the concrete blocker inside the drawer. Bots that are still room members get a clear “先移出房间” message instead of a silent failure.
- **Bot drawer was pinned to the top-right**: it now anchors to the clicked bot row (desktop opens to the left of the row, aligned vertically; mobile remains a bottom sheet). A dependency-free UI test verifies the anchor coordinates.
- **Bot list was too short**: the roster min-height is 300px and the desktop max-height is `calc(100vh - 300px)`, so more bots are visible before scrolling.

## 0.13.5 — 2026-11-10

### Fixed

- **User messages were invisible**: the human bubble used `--dsw-alias-brand-primary`, which is white in the current DSH theme, so the text was white-on-white. Human bubbles now use `--dsw-alias-state-business-primary`.
- **Header actions stacked vertically**: the title block forced `flex: 1 1 100%`; desktop now keeps the title and the 房间/刷新 buttons on one row.
- **Clicking a bot did nothing visible**: bot rows only filtered an activity feed that could be below the fold. Clicking now opens a dedicated bot drawer with status, current tasks, recent activity, edit and delete controls.
- The right rail was one long roster that pushed the activity feed off-screen. It now has **Bot 状态 / 活动流** tabs and an internally scrolling roster.

### Added

- Bot editing: name, role, persona and workspace via the drawer and `PATCH /bots/:id`.
- Bot deletion from the drawer (Main Bot protected; room members must be removed first), with confirmation.

## 0.13.4 — 2026-11-10

### Fixed

- Task runs now use a separate per-bot `taskSessionId` created in the shared workspace, instead of reusing the bot's chat Session. This preserves the chat history and ensures delegated work actually runs with the team workspace cwd.
- Live verification: the researcher's chat `sessionId` stayed unchanged while its task Session was created separately; the task completed and was deleted afterward.

## 0.13.3 — 2026-11-10

### Added

- **Human approval workflow for destructive actions**: `team_bot_delete`, `team_task_delete`, `team_room_delete` and `team_delete` now create a pending approval instead of executing. The command center shows a “待审批” card; approving executes the action exactly once, rejecting cancels it. A model cannot self-approve.
- **Approval API**: `GET /approvals`, `POST /approvals/:id/approve`, `POST /approvals/:id/reject`; pending approvals are included in `/state` and the Main Bot prompt.
- **Approval tests** for one-shot execution and rejected requests.

### Fixed

- Approval records are JSON-safe (`result: null`) so tool output validation no longer fails with “invalid output”.

## 0.13.2 — 2026-11-10

### Added

- **Asynchronous Bot-to-Bot handoff**: `team_handoff` transfers a task to another bot, records the handoff, wakes the target in the background, and lets the sender finish its own turn.
- **Per-bot activity filter** in the command center: click a bot to see only its tool calls, reports, and handoffs.
- **Task room binding**: `team_task_update` accepts `room_id`, so a task created before its room can be attached afterward.
- **Managed bot deletion**: `team_bot_delete` (confirmation required, Main Bot and room members protected).

### Fixed

- Tool activity rows close when their `tool/result` arrives.
- Main Bot now receives the Lead's command in its prompt.
- `run` steps close on turn end; watchdog no longer treats `waiting` as stalled.
- Deleting a task clears the owner's stale presence.

## 0.13.1 — 2026-11-10

### Fixed

- **Main Bot ignored the Lead's command** because `buildMainPrompt()` rendered team state but not the current message. The command is now included in the prompt.
- A task's `run` step stayed `running` after `turn/end`, causing false watchdog alerts; run steps are now closed on every turn end.
- The watchdog treated `waiting` (awaiting acceptance) as stalled; it now monitors only `running` tasks.
- Tool activity rows now close when the matching `tool/result` arrives instead of staying `running`.
- Deleting a task now clears the owner's stale presence.

### Added

- `team_bot_delete` with explicit confirmation and room-membership protection.
- `room_id` binding on `team_task_update`, so a task can be attached to a room after creation.
- Explicit confirmation on room/team deletion tools.

## 0.13.0 — 2026-11-10

### Added

- **Persistent Main Bot**: a real DSH Session with its own persona and a private command-center chat. It can create sub-bots, create rooms, create durable tasks, assign owners, inspect status and summarize work.
- **Task ledger**: durable `Task` records with owner, status, progress, steps, artifacts, parent task and timestamps.
- **Live activity**: `BotRuntime` now taps Session events while a turn runs (`tool/call`, `tool/result`, `assistant/message`, `turn/end`) and writes task steps, presence and a global activity feed.
- **Command center UI**: default Web panel view with Main Bot chat, task board, per-task execution steps, live Bot status and activity stream; the existing room UI is still available.
- **Progress contract**: delegated bots are prompted to call `team_task_report` at start/milestones/blocked/done; runtime still records tool activity automatically.
- **Watchdog**: marks tasks with no update for 90 seconds and posts a proactive Main Bot alert without spending model tokens.
- **Local shared workspace**: all bot Sessions default to a scoped workspace under the plugin data directory. No unrestricted machine access is granted by this change.

## 0.12.4 — 2026-11-09

### Fixed

- The @ member candidate list is now a full-width row inside the composer instead of an absolutely positioned popover, so it is visible above the input on mobile and cannot be clipped by the chat container.

## 0.12.3 — 2026-11-09

### Fixed

- Mobile team panel could show only the header/empty area because the body used `display: block` with `main { height: 100% }`. The mobile body is now a column flex container and the chat area uses `flex: 1`, so it fills the available height.
- The panel is wrapped in an error boundary: a render failure now shows a readable message instead of a blank slot.

## 0.12.2 — 2026-11-09

### Added

- **@ member autocomplete** in the composer: typing `@` lists the current room's members, and choosing one inserts the name and sends the bot id in `mentions`.
- Typing a full `@name` manually is also inferred as an explicit mention at send time.

### Fixed

- Switching rooms now clears the previous timeline immediately and blurs the keyboard first, so the first tap updates the chat panel instead of being consumed by the keyboard.

## 0.12.1 — 2026-11-09

### Fixed

- iPhone horizontal page scroll: constrain the panel root/body/main, break long message text, and let flex inputs shrink.
- iOS auto-zoom on input focus: textarea, text inputs, and selects use 16px on mobile, so the send button no longer shifts under the keyboard.
- Memory, manage, AI compose, and create-room panels are now bottom sheets with a backdrop, close control, 78vh max height, and safe-area padding.
- The phone room drawer is narrower (74%, max 280px) and room names truncate without widening it.

## 0.12.0 — 2026-11-09

### Added

- **Mobile layout for the team panel**: below 720px the room list becomes a drawer with a backdrop, the chat takes the full width, the header wraps, and the composer respects the iPhone safe area.

## 0.11.0 — 2026-11-09

### Fixed

- Clicked room/header buttons no longer keep a browser focus rectangle; the selected room now uses an inset accent bar instead.

### Added

- **Team rename** (`team_rename`, `PATCH /teams/:teamId`): renames the team, its main room, and every member's `teamName`; sub-rooms keep their names.
- **Team summary**: after an ask, the team summary is rebuilt from the latest messages across every room in the team and shown in the panel's team-memory tab.

## 0.10.0 — 2026-11-09

### Added

- **Team-wide memory**: atoms and summaries scoped to a `teamId`, shared by every room in that team and injected after team memory into each bot prompt.
- `team_memory_*` tools accept `scope: "team"` with `team_id`; `team_room_memory` also returns the team document.
- `GET/POST/DELETE /teams/:teamId/memory` and `POST /teams/:teamId/memory/review`.
- The panel memory drawer has **房间记忆 / 团队记忆** tabs.

## 0.9.1 — 2026-11-09

### Changed

- Sidebar room search: filter by room or team name; matching teams expand automatically.
- Team header hover background, count badge, and a clearer chevron.
- The manual create-room form has a Bot search field and shows Bot avatars.

## 0.9.0 — 2026-11-09

### Added

- **Delete room** (`DELETE /rooms/:id`, `team_room_delete`) and **delete team** (`DELETE /teams/:teamId`, `team_delete`), with confirmation in the manage panel.
- Deleting also removes the room timeline and room/bot memory files.

## 0.8.0 — 2026-11-09

### Added

- **Team-grouped room list**: teams collapse under a header (main room + subgroups), with counts and the team avatar.
- **Manage panel**: edit a room's members and chief, including grafting the same chief onto several rooms (`PATCH /rooms/:id`).
- **Timeline polish**: bot avatars beside messages, auto-scroll to the newest message, and the room name/team in the page header.
- More avatar variety: 12 hues and 7 face variants (ears, glasses, halo, initials).

## 0.7.1 — 2026-11-09

### Added

- Arbitrary briefs now go through a hidden **团队架构师** Session that returns a validated JSON role plan; invalid plans fall back to the generic three-role team.
- The architect bot is hidden from `team_bot_list` and `/state`.

## 0.7.0 — 2026-11-09

### Added

- **One-sentence teams**: `team_compose` matches a built-in archetype (short-video, software, content, research), creates every bot, a main room, and sub-rooms with their own chiefs.
- **Team archetypes**: 短视频团队（8 roles / 前期组 / 后期组）, 软件项目团队（6 roles / 产品组 / 开发组 / 测试组）, 内容团队, 研究团队.
- **Bot and room avatars**: deterministic `{hue, variant}` descriptors; the panel draws them as SVG gradient faces.
- **`team_room_update`**: change members/chief/policy, including grafting the same chief onto multiple rooms.
- **Panel AI 建队**: template chips and a free-text brief, plus avatars in the room list and member chips.

### Changed

- Bot names may repeat across teams (role names such as 导演 or 审校 are no longer globally unique).

## 0.6.1 — 2026-11-09

### Added

- Chinese README (`README.zh-CN.md`), linked from the English README and included in the package.
- GitHub install path verified: `npm install github:CoderMrYan/dsh-team-bot` → `added 1 package`.

### Changed

- Install docs now recommend GitHub instead of npm; npm publish is explicitly optional/deferred.

## 0.6.0 — 2026-11-09

### Added

- A permanent left sidebar entry **团队群组** (`sidebar.panellist` id `team-bot`) and its main panel (`main` key `team-bot`), alongside Plugins and Schedules.
- The Settings entry remains as a secondary path.

### Changed

- Panel padding, human-readable policy labels (仅 @ 点名 / 总管挑人 / 自动挑人), and a chat-bubble icon.
- Local `main` pushed to GitHub over SSH (`2928ce6..b25486a`).

## 0.5.2 — 2026-11-09

### Fixed

- The client module now declares `inject: ["slots"]`. Without it `ctx.slots` was undefined during activation, so the Web boot reported `dsh-team-bot: failed` instead of mounting the settings page.

## 0.5.1 — 2026-11-09

### Changed

- `auto` routing now scores each member's name, role and persona against the message tokens before falling back to the first `maxSpeakers` members.
- Verified packaging: `npm pack` (17 files), `npm install <tarball>` (`added 1 package`), and `npm publish --dry-run` (public).

## 0.5.0 — 2026-11-09

### Added

- **Memory review queue**: auto-captured `pending` atoms no longer enter prompts until accepted; `team_memory_review` and `POST /rooms/:id/memory/review` accept, reject or re-open an atom.
- **Panel memory drawer**: summary, atom list with review state, accept/reject/delete, and an inline "remember" input.
- **Packaging**: npm metadata, peer dependencies, CHANGELOG, and a GitHub Actions CI workflow.
- Two more memory checks (pending/rejected recall and review transitions).

## 0.4.0 — 2026-11-09

### Added

- **Shared rooms** with `mention`, `admin` and `auto` routing, `maxSpeakers`, `hopLimit` and `allowPass`.
- **Real-Session runtime**: each bot owns one DSH Session; a room message becomes one real turn, and the assistant text is appended back to the room.
- **Private chats** (`/dms`) and a **chief desk** that gives a room chief its role context.
- **Memory MVP**: shared L1 atoms, extractive L2 summary, per-bot private atoms and persona, BM25-lite recall, explicit capture, tools and HTTP API.
- **Web panel** (client half): a `settings.section` page with room list, timeline, composer, member chips and room creation.
- **Tests**: store, routing, runtime, memory, direct chats and the client bundle (20 checks).

### Known limitations

- The client half mounts after one Harness restart when it is added to an already-booted Host.
- Memory extraction is deterministic, not LLM-based yet.
- The prompt-injection estimate is advisory only; `hopLimit` is enforced per ask, not by an event bus.
