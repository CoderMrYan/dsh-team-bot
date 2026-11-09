# Changelog

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
