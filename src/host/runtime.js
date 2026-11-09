/**
 * Real-Session runtime for dsh-team-bot (P1).
 *
 * Each bot profile owns one ordinary DSH Session. A turn is one admitted
 * prompt; the runtime waits for the Session's `turn/end`, then extracts the
 * assistant text and returns it to the room.
 */
import { randomUUID } from 'node:crypto'

/** @returns {Promise<void>} a sleep helper bound to the caller's signal. */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    if (signal !== undefined) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('aborted'))
      }, { once: true })
    }
  })
}

/** @returns {string} concatenated text blocks of one assistant message. */
export function textOf(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

/** @returns {string} the model-facing room prompt for one bot turn. */
export function buildRoomPrompt(room, bot, messages) {
  const recent = messages
    .slice(-12)
    .map((message) => {
      const who = message.sender.type === 'bot' ? message.sender.name : 'human'
      return `[${who}] ${String(message.text).slice(0, 500)}`
    })
    .join('\n')
  return `You are "${bot.name}", ${bot.role}, in the DSH group room "${room.name}".

${bot.persona}

Recent room messages (oldest first):
${recent}

Reply to the latest message as ${bot.name}. Rules:
- Reply in Chinese unless the room is in another language.
- Keep it under 200 Chinese characters.
- Do not repeat what others said; add new information or a concrete next step.
- If you have nothing useful to add, reply exactly [PASS].`
}

export class BotRuntime {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx
   * @param {import('./store.js').TeamStore} store
   * @param {{ timeoutMs?: number, pollMs?: number }} options
   */
  constructor(ctx, store, options = {}) {
    this.ctx = ctx
    this.store = store
    this.timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 180_000
    this.pollMs = Number.isInteger(options.pollMs) ? options.pollMs : 750
    this.chains = new Map()
  }

  /** @returns {Promise<object[]>} current Session events. */
  async events(sessionId, signal) {
    const snapshot = await this.ctx.sessionController.inspect(sessionId, signal)
    return snapshot.events ?? []
  }

  /** Resolve or create the ordinary Session owned by one bot profile. */
  async ensureSession(bot, signal) {
    if (typeof bot.sessionId === 'string' && bot.sessionId !== '') {
      try {
        const resolved = await this.ctx.sessionController.resolveAgent(bot.sessionId)
        if (resolved?.agent !== undefined) return bot.sessionId
      } catch {
        // A deleted or unreadable Session falls through to a new one.
      }
    }
    const created = await this.ctx.sessionController.create({
      ...(typeof bot.workspace === 'string' && bot.workspace !== '' ? { cwd: bot.workspace } : {}),
    })
    bot.sessionId = created.sessionId
    await this.store.save()
    return bot.sessionId
  }

  /**
   * Ask one bot one turn and return its assistant text.
   * Calls for the same bot serialize so two room messages cannot interleave.
   */
  ask(bot, prompt, signal) {
    const previous = this.chains.get(bot.id) ?? Promise.resolve()
    const run = previous.then(() => this.runTurn(bot, prompt, signal), () => this.runTurn(bot, prompt, signal))
    this.chains.set(bot.id, run.then(() => undefined, () => undefined))
    return run
  }

  async runTurn(bot, prompt, signal) {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const fused = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    const sessionId = await this.ensureSession(bot, fused)
    const before = await this.events(sessionId, fused)
    const startSeq = before.at(-1)?.seq ?? -1
    await this.ctx.sessionController.prompt(
      {
        requestId: `team-bot-${randomUUID()}`,
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: prompt }],
      },
      fused,
    )
    const deadline = Date.now() + this.timeoutMs
    while (Date.now() < deadline) {
      if (fused.aborted) throw new Error('team-bot turn aborted')
      await sleep(this.pollMs, fused)
      const events = await this.events(sessionId, fused)
      const fresh = events.filter((event) => event.seq > startSeq)
      const ended = fresh.find((event) => event.type === 'turn/end')
      if (ended === undefined) continue
      const assistant = [...fresh].reverse().find((event) => event.type === 'assistant/message')
      return assistant === undefined ? '' : textOf(assistant.data?.message?.content)
    }
    throw new Error(`team-bot turn timed out after ${this.timeoutMs}ms`)
  }
}
