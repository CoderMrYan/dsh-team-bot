/**
 * Real-Session runtime for dsh-team-bot.
 *
 * Each bot profile owns one ordinary DSH Session. A turn is one admitted
 * prompt. While the turn runs, the runtime taps the durable Session events so
 * the room, the command center and the task ledger can show what the bot is
 * actually doing instead of only its final answer.
 */
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { formatMemory } from './memory.js'

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

/** @returns {string} a short single-line detail for activity cards. */
function compact(value, limit = 220) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`
}

/** @returns {string} a readable summary of raw tool arguments. */
function summarizeArgs(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return ''
  try {
    const value = JSON.parse(raw)
    if (value === null || typeof value !== 'object') return compact(value)
    return compact(Object.entries(value).map(([key, item]) => `${key}=${typeof item === 'string' ? item : JSON.stringify(item)}`).join(' · '))
  } catch {
    return compact(raw)
  }
}

/** @returns {string} the model-facing task block for a delegated task. */
function taskSection(task) {
  if (task === undefined || task === null) return ''
  return `

TASK CONTRACT
- Task id: ${task.id}
- Title: ${task.title}
- Brief: ${task.brief || '(none)'}
- Owner: ${task.ownerBotId || 'you'}
- Call team_task_report({ task_id: "${task.id}", status: "running", progress: 10, message: "..." }) at start, at every milestone, when blocked, and when finished.
- Put deliverables in the shared team workspace and report their paths with team_task_artifact when possible.
- If another bot owns the next stage, call team_handoff with this task id and the target bot id instead of doing everything yourself.
- If you need a decision or are blocked, report status "blocked" with the concrete question. Do not silently stall.`
}

/** @returns {string} the model-facing room prompt for one bot turn. */
export function buildRoomPrompt(room, bot, messages, memory, task) {
  const recent = messages
    .slice(-12)
    .map((message) => {
      const who = message.sender.type === 'bot' ? message.sender.name : 'human'
      return `[${who}] ${String(message.text).slice(0, 500)}`
    })
    .join('\n')
  const query = memory?.query ?? messages.at(-1)?.text ?? ''
  const memoryBlock = memory === undefined ? '' : formatMemory(memory.roomMemory, memory.botMemory, query, memory.teamMemory)
  const memorySection = memoryBlock === '' ? '' : `\n\n${memoryBlock}`
  return `You are "${bot.name}", ${bot.role}, in the DSH group room "${room.name}".

${bot.persona}${memorySection}${taskSection(task)}

Recent room messages (oldest first):
${recent}

Reply to the latest message as ${bot.name}. Rules:
- Reply in Chinese unless the room is in another language.
- Keep it under 200 Chinese characters.
- Do not repeat what others said; add new information or a concrete next step.
- If you have nothing useful to add, reply exactly [PASS].`
}

/** @returns {string} the model-facing prompt for one private chat turn. */
export function buildDirectPrompt(bot, messages, memory, note, task) {
  const recent = messages
    .slice(-12)
    .map((message) => {
      const who = message.sender.type === 'bot' ? message.sender.name : 'human'
      return `[${who}] ${String(message.text).slice(0, 500)}`
    })
    .join('\n')
  const query = memory?.query ?? messages.at(-1)?.text ?? ''
  const block = memory === undefined ? '' : formatMemory(undefined, memory.botMemory, query)
  const section = block === '' ? '' : `\n\n${block}`
  const noteBlock = typeof note === 'string' && note.trim() !== '' ? `\n\n${note.trim()}` : ''
  return `You are "${bot.name}", ${bot.role}, in a private DSH chat with the Lead (human).

${bot.persona}${noteBlock}${section}${taskSection(task)}

Recent private messages (oldest first):
${recent}

Reply as ${bot.name}. Rules:
- Reply in Chinese unless the Lead writes in another language.
- Keep it under 200 Chinese characters.
- If the Lead asks you to post into a room, use team_room_post with the room id and your bot id.
- If you have nothing useful to add, reply exactly [PASS].`
}

/** @returns {string} the model-facing prompt for a delegated task. */
export function buildTaskPrompt(bot, task, room, memory) {
  const query = task.brief || task.title
  const memoryBlock = memory === undefined ? '' : formatMemory(memory.roomMemory, memory.botMemory, query, memory.teamMemory)
  const memorySection = memoryBlock === '' ? '' : `\n\n${memoryBlock}`
  const roomLine = room === undefined ? '' : `\nShared room: "${room.name}" (${room.id}). Post a concise result there when useful.`
  return `You are "${bot.name}", ${bot.role}. You have been assigned a durable task by the Main Bot.${roomLine}

${bot.persona}${memorySection}${taskSection(task)}

Work the task now. Use your tools to inspect files, run commands, search the web, write artifacts, and verify results. Rules:
- Reply in Chinese unless the task is in another language.
- This is not a one-line roleplay reply: do the work, then report a concrete result.
- Call team_task_report with task_id "${task.id}" and bot_id "${bot.id}" when starting, at each major milestone, if blocked, and when done.
- Keep the room/command center informed with short operational updates; do not silently run for a long time.
- If you need a human decision, report status "blocked" and state the exact question.`
}

/** @returns {string} the model-facing prompt for the main orchestrator. */
export function buildMainPrompt(mainBot, bots, rooms, tasks, presence, approvals = [], command = '') {
  const botLines = bots.map((bot) => `- ${bot.id} ${bot.name} | ${bot.role} | ${bot.isMain ? 'MAIN' : 'sub-bot'}`).join('\n')
  const roomLines = rooms.map((room) => `- ${room.id} ${room.name} | members: ${room.members.join(', ')} | chief: ${room.chiefId || 'none'}`).join('\n')
  const taskLines = tasks.slice(0, 20).map((task) => `- ${task.id} [${task.status}] ${task.title} | owner: ${task.ownerBotId || 'unassigned'} | ${task.currentStep || 'no step'}`).join('\n')
  const presenceLines = presence.map((row) => `- ${row.botId}: ${row.status}${row.action ? ` · ${row.action}` : ''}`).join('\n')
  const approvalLines = approvals.map((approval) => `- ${approval.id} | ${approval.kind} | ${approval.summary}`).join('\n')
  return `You are "${mainBot.name}", the MAIN BOT and orchestrator of this DSH team.

You are a real agent with your own Session, not a settings page. Talk to the Lead naturally, decide what needs to happen, and use tools to make it happen. The Lead can ask you to create sub-bots, create groups, assign tasks, inspect progress, unblock work, or summarize the team.

Current team:
${botLines || '- no bots yet'}

Rooms:
${roomLines || '- no rooms yet'}

Tasks:
${taskLines || '- no tasks yet'}

Live presence:
${presenceLines || '- no presence yet'}

Pending approvals:
${approvalLines || '- none'}

The Lead's latest command (act on this now):
${command || '(none)'}

Operating rules:
- For non-trivial work, create a task first (team_task_create), then create or choose a sub-bot and assign it (team_task_assign).
- If the task belongs to a room, pass room_id when creating it; if it was created without one, bind it with team_task_update(room_id).
- A sub-bot must report through team_task_report; when you need a status, call team_task_status or read the task.
- Keep the Lead informed with short progress updates, especially after a command, a handoff, a block, and a completion.
- Do not claim a sub-bot did work unless the task/activity log shows it.
- Destructive actions (deleting bots, rooms, teams or tasks) create a pending approval. Tell the Lead to approve it in the command center, then call the same tool with its approval_id. Never claim a destructive action succeeded before it is approved and executed.
- Reply in Chinese unless the Lead writes in another language. Be concise and operational.
- If you are only chatting, do not invent tool calls.`
}

export class BotRuntime {
  /**
   * @param {import('@deepseek-ai/cordis').Context} ctx
   * @param {import('./store.js').TeamStore} store
   * @param {{ timeoutMs?: number, pollMs?: number, workspaceRoot?: string }} options
   */
  constructor(ctx, store, options = {}) {
    this.ctx = ctx
    this.store = store
    this.timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 180_000
    this.pollMs = Number.isInteger(options.pollMs) ? options.pollMs : 600
    this.workspaceRoot = String(options.workspaceRoot ?? '').trim()
    this.chains = new Map()
    this.active = new Map()
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
    const cwd = typeof bot.workspace === 'string' && bot.workspace !== ''
      ? bot.workspace
      : this.workspaceRoot
    const created = await this.ctx.sessionController.create({
      ...(cwd === '' ? {} : { cwd }),
    })
    bot.sessionId = created.sessionId
    await this.store.save()
    return bot.sessionId
  }

  /**
   * Ask one bot one turn and return its assistant text.
   * Calls for the same bot serialize so two room messages cannot interleave.
   * @param {object} bot
   * @param {string} prompt
   * @param {AbortSignal} [signal]
   * @param {{ taskId?: string, roomId?: string, autoStart?: boolean }} [context]
   */
  ask(bot, prompt, signal, context = {}) {
    const previous = this.chains.get(bot.id) ?? Promise.resolve()
    const run = previous.then(
      () => this.runTurn(bot, prompt, signal, context),
      () => this.runTurn(bot, prompt, signal, context),
    )
    this.chains.set(bot.id, run.then(() => undefined, () => undefined))
    return run
  }

  /** @returns {string} the currently active task for a bot, if any. */
  activeTask(botId) {
    return this.active.get(botId) ?? ''
  }

  async presence(bot, patch) {
    try {
      await this.store.setPresence(bot.id, patch)
    } catch {
      // Presence is observability; a failed write must not kill the turn.
    }
  }

  async activity(input) {
    try {
      return await this.store.recordActivity(input)
    } catch {
      return undefined
    }
  }

  async handleEvent(bot, event, context) {
    const data = event?.data ?? {}
    const taskId = context.taskId ?? ''
    if (event.type === 'turn/start' || event.type === 'step/start') {
      await this.presence(bot, { status: 'thinking', action: '思考中', taskId })
      return
    }
    if (event.type === 'tool/call') {
      const name = String(data.name ?? 'tool')
      const detail = summarizeArgs(data.arguments)
      await this.presence(bot, { status: 'tool', action: `调用 ${name}`, taskId })
      await this.activity({
        botId: bot.id,
        taskId,
        kind: 'tool',
        label: `调用 ${name}`,
        detail,
        status: 'running',
        callId: String(data.callId ?? ''),
      })
      return
    }
    if (event.type === 'tool/result') {
      const callId = String(data.message?.toolCallId ?? '')
      const failed = data.message?.isError === true || data.error !== undefined
      if (taskId !== '' && callId !== '') {
        try {
          await this.store.finishTaskStep(taskId, callId, {
            status: failed ? 'error' : 'done',
            detail: failed ? String(data.error?.reason ?? '') : '',
          })
        } catch {
          // Ignore missing task/step after a restart.
        }
      }
      try {
        await this.store.finishActivity(callId, {
          status: failed ? 'error' : 'done',
          detail: failed ? String(data.error?.reason ?? '') : '',
        })
      } catch {
        // Activity is observability only.
      }
      await this.presence(bot, { status: 'thinking', action: failed ? '工具失败，继续处理' : '读取工具结果', taskId })
      await this.activity({
        botId: bot.id,
        taskId,
        kind: 'tool-result',
        label: failed ? '工具失败' : '工具完成',
        detail: failed ? String(data.error?.reason ?? data.message?.source?.toolName ?? '') : '',
        status: failed ? 'error' : 'done',
        callId,
      })
      return
    }
    if (event.type === 'assistant/message') {
      const text = textOf(data.message?.content)
      if (text !== '') {
        await this.activity({
          botId: bot.id,
          taskId,
          kind: 'message',
          label: '模型回复',
          detail: compact(text),
          status: 'done',
        })
      }
      await this.presence(bot, { status: 'thinking', action: '组织回复', taskId })
      return
    }
    if (event.type === 'turn/end') {
      const reason = String(data.reason?.kind ?? 'completed')
      if (taskId !== '') {
        try {
          const task = this.store.getTask(taskId)
          await this.store.finishOpenTaskSteps(
            taskId,
            reason === 'completed' ? 'done' : 'error',
            reason === 'completed' ? '本轮执行结束' : `本轮结束：${reason}`,
            'run',
          )
          if (reason === 'error') {
            await this.store.updateTask(taskId, { status: 'failed', currentStep: '执行失败' })
          } else if (reason === 'blocked' || reason === 'aborted') {
            await this.store.updateTask(taskId, { status: 'blocked', currentStep: '执行被中断' })
          } else if (!['done', 'failed'].includes(task.status)) {
            await this.store.updateTask(taskId, { status: 'waiting', currentStep: '本轮结束，等待验收' })
          }
        } catch {
          // A task may have been deleted while the turn was running.
        }
      }
      await this.presence(bot, { status: 'idle', action: reason === 'completed' ? '空闲' : reason, taskId: '' })
    }
  }

  async runTurn(bot, prompt, signal, context = {}) {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const fused = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
    const sessionId = await this.ensureSession(bot, fused)
    const taskId = String(context.taskId ?? '')
    this.active.set(bot.id, taskId)
    if (taskId !== '') {
      try {
        await this.store.updateTask(taskId, { status: 'running', ownerBotId: bot.id })
        await this.store.addTaskStep(taskId, {
          kind: 'run',
          label: '开始执行',
          detail: compact(prompt),
          status: 'running',
        })
      } catch {
        // Do not block a turn because an orphaned task vanished.
      }
    }
    await this.presence(bot, { status: 'thinking', action: '接收任务', taskId })
    const before = await this.events(sessionId, fused)
    let lastSeq = before.at(-1)?.seq ?? -1
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
    let assistantText = ''
    try {
      while (Date.now() < deadline) {
        if (fused.aborted) throw new Error('team-bot turn aborted')
        await sleep(this.pollMs, fused)
        const events = await this.events(sessionId, fused)
        const fresh = events.filter((event) => event.seq > lastSeq)
        for (const event of fresh) {
          lastSeq = event.seq
          await this.handleEvent(bot, event, { taskId })
          if (event.type === 'assistant/message') {
            const text = textOf(event.data?.message?.content)
            if (text !== '') assistantText = text
          }
          if (event.type === 'turn/end') {
            return assistantText
          }
        }
      }
    } finally {
      this.active.delete(bot.id)
    }
    if (taskId !== '') {
      try {
        await this.store.updateTask(taskId, { status: 'blocked', currentStep: '执行超时' })
      } catch {
        // ignore
      }
    }
    await this.presence(bot, { status: 'blocked', action: '执行超时', taskId: '' })
    throw new Error(`team-bot turn timed out after ${this.timeoutMs}ms`)
  }
}

/** Resolve the shared workspace directory used when a bot has no explicit cwd. */
export function defaultWorkspace(dataDir) {
  return path.join(dataDir, 'workspace')
}
