# dsh-team-bot

Native multi-agent group chat for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

> Status: **P0 + P1 + P2** — room store, routing, tools, real-Session runtime, and a native Web panel. The client half mounts after the next Harness restart; memory (P3) is next.

## Why

DSH already has single agents, subagents, and an experimental Agent Teams runtime. What it lacks is a **shared room** where a person and several named bots talk in one timeline, with a chief that routes work, a group note that survives, and memory that belongs to the room rather than one session.

`dsh-team-bot` is that layer. It is a normal DSH plugin bundle: it adds Host services, model tools, and (from P2) a Web client. It does not fork or patch DSH.

## Product shape

- **Shared room** — one timeline for the human and several bots; `@`, chief routing, or automatic routing.
- **Chief desk + private chats** — the chief has its own session, can bring conclusions back to the room, and can hand work to members.
- **Memory** — shared room memory (L0 raw → L1 facts → L2 summary → L3 persona) plus per-bot private memory.
- **Real sessions** — each bot is backed by a real DSH session, so tools, approvals, streaming, search, and model selection are inherited rather than reimplemented.

## P0 + P1 + P2 (this commit)

```text
src/host/
  index.js      plugin entry, data dir, runtime, tools, routes
  store.js      rooms, bots, messages, memory shells, JSON/JSONL persistence
  routing.js    mention / admin / auto routing
  runtime.js    real-Session turns: create/resume, prompt, wait for turn/end
  actions.js    shared "post + run routed bots" action
  routes.js     /dsh-team-bot/api/* for the Web panel
  tools.js      team_* model tools
lib/client.js   Web panel: settings.section "团队群组"
test/           store, runtime, and client-bundle smoke tests
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
| `team_room_memory` | read shared and per-bot memory shells |

### How a turn works

1. `team_room_ask` posts the human message and gets `routed`.
2. For each routed bot: `sessionController.create` (first time) or `resolveAgent` (later), then `prompt` with the bot persona, the room name, and the last 12 messages.
3. The runtime polls the Session log for `turn/end`, extracts the last `assistant/message` text, and appends it to the room as that bot.
4. `[PASS]` and empty replies are skipped. Per-bot calls serialize; the tool waits for the whole routed batch.

Bot profiles persist their `sessionId`, so the next room message continues the same conversation and the same DSH session.

### Web panel (P2)

Open **Settings → 团队群组** after the next Harness restart. The page lists rooms, shows member chips and the timeline, sends through the same runtime as `team_room_ask`, and creates rooms with bot checkboxes.

Routes under `/dsh-team-bot/api`: `health`, `state`, `client`, `rooms` (POST), `rooms/:id/messages`, `rooms/:id/ask`, `rooms/:id/memory`.

The client half is new: a package that gains `dsh.client` after the Host already booted needs one **Harness restart** for the client module graph to include it. After that, enabling/disabling the plugin row is enough.

## Data model

```text
$DSH_HOME/dsh-team-bot/
  state.json                 # version, seq, bots, rooms
  messages/<roomId>.jsonl    # append-only timeline
  memory/room/<roomId>.json  # shared memory (P3)
  memory/bot/<botId>.json    # per-bot memory (P3)
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

## Develop

```bash
node --test test/store.test.js test/runtime.test.js test/client.test.js
node --check src/host/index.js
```

The repo is a DSH bundle. Install the directory with `plugin_manager install_bundle` (or `dsh plugin add`) and it appears as one plugin row.

## Roadmap

- [x] P0 room store, routing, tools, tests
- [x] P1 real-Session runtime: one Session per bot, prompt, wait for `turn/end`, append replies, per-bot serialization
- [x] P2 Web panel: room list, timeline, composer, member chips, room creation (client half mounts after one Harness restart)
- [ ] P3 memory: L0–L3, hybrid recall, review queue
- [ ] P4 schedules, task dispatch, usage, packaging, CI, publish

## Design references

- [dsh-bot](https://github.com/lisongjianustc/dsh-bot) — real-session bots, group relay, maxSpeakers, group note
- [dsh-team-workbench](https://github.com/narkco-kang/dsh-team-workbench) — L0–L3 memory, department-as-one-agent, panel patterns
- [dsh-superagent-prototype](https://github.com/deepseek-ai/dsh-superagent-prototype) — attention budget and authorization philosophy

These are references for ideas; this repository does not copy their code.

## License

MIT.
