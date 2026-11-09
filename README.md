# dsh-team-bot

Native multi-agent group chat for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

[English](README.md) | [简体中文](README.zh-CN.md)

> Status: **0.6.1** — shared rooms, real-Session runtime, memory with review queue, private chats/chief desk, and a Web panel reachable from the left sidebar. Install from GitHub; npm publish is optional and not done.

## Why

DSH already has single agents, subagents, and an experimental Agent Teams runtime. What it lacks is a **shared room** where a person and several named bots talk in one timeline, with a chief that routes work, a group note that survives, and memory that belongs to the room rather than one session.

`dsh-team-bot` is that layer. It is a normal DSH plugin bundle: it adds Host services, model tools, and (from P2) a Web client. It does not fork or patch DSH.

## Product shape

- **Shared room** — one timeline for the human and several bots; `@`, chief routing, or automatic routing.
- **Chief desk + private chats** — the chief has its own session, can bring conclusions back to the room, and can hand work to members.
- **Memory** — shared room memory (L0 raw → L1 facts → L2 summary → L3 persona) plus per-bot private memory.
- **Real sessions** — each bot is backed by a real DSH session, so tools, approvals, streaming, search, and model selection are inherited rather than reimplemented.

## Layout

```text
src/host/
  index.js      plugin entry, data dir, runtime, tools, routes
  store.js      rooms, bots, messages, memory documents, persistence
  routing.js    mention / admin / auto routing
  runtime.js    real-Session turns: create/resume, prompt, wait for turn/end
  actions.js    shared "post + run routed bots + capture memory" action
  routes.js     /dsh-team-bot/api/* for the Web panel
  memory.js     L1 atoms, L2 extractive summary, L3 persona, BM25-lite recall
  tools.js      team_* model tools
lib/client.js   sidebar + main panel + settings.section "团队群组"
test/           store, routing, runtime, memory, client-bundle tests
```

Tools:

| Tool | Purpose |
|---|---|
| `team_bot_create` | create a named bot profile (role, persona, model, workspace) |
| `team_bot_list` | list profiles and their bound Session ids |
| `team_room_create` | create a room with members, chief, reply policy |
| `team_room_list` | list rooms |
| `team_room_post` | append a message and return the routed bots (store only) |
| `team_room_ask` | append a human message, run the routed bots as real turns, append their replies |
| `team_room_history` | read the latest messages |
| `team_room_memory` | read shared and per-bot memory |
| `team_memory_remember` | add/supersede a shared or private fact |
| `team_memory_forget` | remove one atom by id |
| `team_memory_persona` | add an L3 standing preference to a bot |
| `team_memory_review` | accept / reject / re-open one atom |
| `team_dm_ask` | run one private chat turn with a bot |
| `team_dm_history` | read a private conversation |
| `team_dm_list` | list private conversations |
| `team_chief_desk` | talk to a room chief with its chief role context |

### How a turn works

1. `team_room_ask` posts the human message and gets `routed`.
2. Routing: explicit `@` wins; `admin` goes to the chief; `auto` scores each bot's name, role and persona tokens against the message, then falls back to the first `maxSpeakers` members when nothing matches.
3. For each routed bot: `sessionController.create` (first time) or `resolveAgent` (later), then `prompt` with the bot persona, the room name, and the last 12 messages.
4. The runtime polls the Session log for `turn/end`, extracts the last `assistant/message` text, and appends it to the room as that bot.
5. `[PASS]` and empty replies are skipped. Per-bot calls serialize; the tool waits for the whole routed batch.

Bot profiles persist their `sessionId`, so the next room message continues the same conversation and the same DSH session.

### Memory (P3 MVP)

- **L0** — the append-only room JSONL stays the source of truth.
- **L1** — atoms `{key, text, importance, review}`. Same `key` supersedes, a near-duplicate (Jaccard ≥ 0.8) is skipped, and the list is capped at 40 by importance.
- **L2** — an extractive summary over the last 8 messages, refreshed after every `ask`.
- **L3** — per-bot standing preferences (`team_memory_persona`), capped at 12.
- **Capture** — a human message containing 记住 / 以后 / 决定 / 规则是 / 不要 / 必须 / 约定 becomes an atom: 记住 is accepted, the rest stay pending for review.
- **Recall** — CJK bigrams + ASCII words, token overlap plus an importance prior; top 4 shared and top 4 private atoms are injected into the bot prompt with the summary. Only **accepted** atoms are recalled.
- **Review** — auto-captured atoms that are not an explicit 记住 stay `pending`; `team_memory_review` and the panel drawer accept, reject or re-open them. Rejected atoms stay in the document as tombstones but never enter a prompt.
- **Write paths** — model tools (`team_memory_*`), the panel drawer, and `POST` / `DELETE /rooms/:id/memory` plus `POST /rooms/:id/memory/review`.
- **Limit** — this is deterministic extraction, not an LLM summarizer; LLM extraction remains future work.

### Private chats and chief desk (P3.5)

- Each bot can have a 1:1 conversation, stored in `messages/dm-<botId>.jsonl`; it uses the same real Session as its room turns, so context and the per-bot serial queue are shared.
- `team_dm_ask` runs one private turn with the bot persona, private atoms and private summary.
- `team_chief_desk` resolves a room's chief and adds a note that it is the chief and can post conclusions back with `team_room_post`.
- Routes: `GET /dms`, `GET /dms/:id/messages`, `POST /dms/:id/ask`.

### Web panel

Click **团队群组** in the left sidebar, or open **Settings → 团队群组**. The page lists rooms, shows member chips and the timeline, sends through the same runtime as `team_room_ask`, creates rooms with bot checkboxes, and has a memory drawer with accept/reject.

Routes under `/dsh-team-bot/api`: `health`, `state`, `client`, `rooms` (POST), `rooms/:id/messages`, `rooms/:id/ask`, `rooms/:id/memory`, `rooms/:id/memory/review`, `dms`.

A package that gains `dsh.client` after the Host already booted needs one **Harness restart** for the client module graph to include it; after that, enabling/disabling the plugin row is enough.

## Data model

```text
$DSH_HOME/dsh-team-bot/
  state.json                 # version, seq, bots, rooms, directs
  messages/<roomId>.jsonl    # append-only room timeline
  messages/dm-<botId>.jsonl  # append-only private timeline
  memory/room/<roomId>.json  # shared memory
  memory/bot/<botId>.json    # per-bot memory
```

Room policy:

```json
{
  "replyMode": "mention | admin | auto",
  "maxSpeakers": 3,
  "hopLimit": 2,
  "allowPass": true
}
```

## Install

From GitHub (recommended while npm publish is deferred):

```bash
dsh plugin --profile web add github:CoderMrYan/dsh-team-bot
```

From a local checkout:

```bash
dsh plugin --profile web add D:\applications\dsh\dsh-team-bot
```

The directory can also be installed through the Plugins page (`plugin_manager install_bundle`). The Host half (tools, routes, memory) is live immediately; the Web client half mounts after one Harness restart when the package first gains `dsh.client`.

Verified packaging:

- `npm install github:CoderMrYan/dsh-team-bot` → `added 1 package` (client, host, and locale files all present)
- `npm pack` → 17 files, ~22 kB (LICENSE / README / CHANGELOG / client / host / locale)
- `npm install <tarball>` → `added 1 package`
- `npm publish --dry-run` → passes with public access (not published)
- Client bundle: registration smoke plus a React SSR render (title and empty state, ~1.5 kB HTML)

```yaml
- id: team-bot
  config:
    dataDir: ''   # default $DSH_HOME/dsh-team-bot
```

## Develop

```bash
node --test test/store.test.js test/runtime.test.js test/memory.test.js test/direct.test.js test/client.test.js
node --check src/host/index.js
```

The repo is a DSH bundle. Install the directory with `plugin_manager install_bundle` (or `dsh plugin add`) and it appears as one plugin row.

## Roadmap

- [x] P0 room store, routing, tools, tests
- [x] P1 real-Session runtime: one Session per bot, prompt, wait for `turn/end`, append replies, per-bot serialization
- [x] P2 Web panel: room list, timeline, composer, member chips, room creation (client half mounts after one Harness restart)
- [x] P3 memory MVP: L1 atoms, L2 extractive summary, L3 persona, BM25-lite recall, explicit capture, tools and API
- [x] P3.5 private chats and chief desk: per-bot DM timeline, DM runtime, chief role note, `/dms` API
- [x] P3.6 memory review queue and panel drawer: pending atoms stay out of prompts, accept/reject, add/delete, summary
- [x] P4 packaging and CI: npm metadata, peer deps, CHANGELOG, GitHub Actions
- [x] P5 GitHub release path: SSH push done; `dsh plugin add github:CoderMrYan/dsh-team-bot` verified
- [ ] npm publish (optional, deferred)

## Design references

- [dsh-bot](https://github.com/lisongjianustc/dsh-bot) — real-session bots, group relay, maxSpeakers, group note
- [dsh-team-workbench](https://github.com/narkco-kang/dsh-team-workbench) — L0–L3 memory, department-as-one-agent, panel patterns
- [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) — attention budget and authorization philosophy

These are references for ideas; this repository does not copy their code.

## License

MIT.
