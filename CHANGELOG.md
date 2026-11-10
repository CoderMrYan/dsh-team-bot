# Changelog

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
