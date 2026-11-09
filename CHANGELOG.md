# Changelog

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
