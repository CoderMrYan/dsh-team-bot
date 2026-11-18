/**
 * Real-Session runtime for dsh-team-bot.
 *
 * Each bot profile owns one ordinary DSH Session. A turn is one admitted
 * prompt. While the turn runs, the runtime taps the durable Session events so
 * the room, the command center and the task ledger can show what the bot is
 * actually doing instead of only its final answer.
 */
import { randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
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

/**
 * Split one `provider/model` bot setting. Model ids may contain slashes, so only
 * the text before the first slash names the provider route.
 * @param {string} value - the stored bot model setting.
 * @returns {{ provider: string, model: string } | undefined} the parsed selection, or undefined when unset.
 */
export function parseModelRef(value) {
  const ref = String(value ?? '').trim()
  if (ref === '') return undefined
  const slash = ref.indexOf('/')
  if (slash <= 0 || slash === ref.length - 1) {
    throw new Error(`bot model must be "provider/model": ${ref}`)
  }
  return { provider: ref.slice(0, slash), model: ref.slice(slash + 1) }
}

/**
 * Tools that run another bot's turn inside this one. While one of these is in
 * flight the parent's wall clock is paused, so a long child review cannot be
 * killed by the parent's own budget.
 */
const DELEGATION_TOOLS = new Set([
  'team_task_assign',
  'team_handoff',
  'team_room_ask',
  'team_dm_ask',
  'team_chief_desk',
  'team_compose',
])

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
- Acceptance criteria: ${task.acceptanceCriteria || '(not specified; infer concrete, checkable criteria)'}
- Reviewer bot: ${task.reviewerBotId || '(not assigned yet)'}
- Workspace: ${task.workspace || '(assigned when this task starts)'}
- Owner: ${task.ownerBotId || 'you'}
- Call team_task_report({ task_id: "${task.id}", status: "running", progress: 10, message: "..." }) at start, at every milestone, when blocked, and when finished.
- Put deliverables in this task's workspace and register their paths with team_task_artifact.
- When the deliverable is ready, call team_task_submit_review with a concrete summary. Do not mark the task done yourself; an independent reviewer must approve it.
- Do not set sandbox_permissions to "danger-full-access" from a team bot. Work inside the shared workspace; if the task truly needs full machine access, report blocked and let the Lead enable it explicitly.
- If another bot owns the next stage, call team_handoff with this task id and the target bot id instead of doing everything yourself.
- If a tool returns an approval cancelled/unavailable error, do not retry the same call. Report the blocker and ask the Lead to change the DSH execution policy or use a workspace/session with shell access.
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
- Do not reply with a final answer only; register the deliverable with team_task_artifact, then call team_task_submit_review with a concrete summary. The reviewer, not you, decides done.
- Call team_task_report with task_id "${task.id}" and bot_id "${bot.id}" when starting, at each major milestone, and when blocked. When the deliverable is ready, register it and call team_task_submit_review; do not mark it done yourself.
- Keep the room/command center informed with short operational updates; do not silently run for a long time.
- If you need a human decision, report status "blocked" and state the exact question.`
}

/** @returns {string} the model-facing prompt for an independent task review. */
export function buildReviewPrompt(bot, task, room) {
  const roomLine = room === undefined ? '' : `\nShared room: "${room.name}" (${room.id}).`
  const artifacts = (task.artifacts ?? [])
    .map((artifact) => `- ${artifact.relative || artifact.path} (${artifact.size ?? 0} bytes)`)
    .join('\n')
  return `You are "${bot.name}", ${bot.role}. You are the independent reviewer for a task you did not write.${roomLine}

Task id: ${task.id}
Title: ${task.title}
Owner: ${task.ownerBotId}
Brief: ${task.brief || '(none)'}
Acceptance criteria: ${task.acceptanceCriteria || '(not specified)'}
Workspace: ${task.workspace || '(none)'}

Deliverables:
${artifacts || '- none registered'}

Review rules:
- Read the task with team_task_get and inspect the deliverables in the workspace.
- Do not modify the deliverables; you are checking, not producing.
- Check every acceptance criterion and look for concrete missing evidence.
- Call team_task_review with task_id "${task.id}", your reviewer_bot_id "${bot.id}", and verdict "approve", "changes" or "reject".
- "changes" sends the task back to the owner with your notes; three failed rounds block it.
- Reply in Chinese unless the task is in another language, and keep the final review note concrete.
`
}

/** @returns {string} the model-facing prompt for the main orchestrator. */
export function buildMainPrompt(mainBot, bots, rooms, tasks, presence, approvals = [], command = '') {
  const botLines = bots.map((bot) => `- ${bot.id} ${bot.name} | ${bot.role} | ${bot.isMain ? 'MAIN' : 'sub-bot'}`).join('\n')
  const roomLines = rooms.map((room) => `- ${room.id} ${room.name} | members: ${room.members.join(', ')} | chief: ${room.chiefId || 'none'}`).join('\n')
  const taskLines = tasks.slice(0, 20).map((task) => `- ${task.id} [${task.status}] ${task.title} | owner: ${task.ownerBotId || 'unassigned'} | reviewer: ${task.reviewerBotId || 'none'} | review: ${task.reviewStatus} | ${task.currentStep || 'no step'}`).join('\n')
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
- For non-trivial work, create a task first (team_task_create), then create or choose a sub-bot and dispatch it with team_task_dispatch. Give the task acceptance criteria and, whenever possible, a reviewer that is not the owner. Use team_task_assign only for a deliberately short synchronous task.
- An owner cannot mark a task done. It must register an artifact and call team_task_submit_review; the reviewer calls team_task_review. Three failed review rounds block the task.
- If the task belongs to a room, pass room_id when creating it; if it was created without one, bind it with team_task_update(room_id).
- A sub-bot must report through team_task_report; when you need a status, call team_task_list or team_task_get.
- Keep the Lead informed with short progress updates, especially after a command, a handoff, a block, and a completion.
- Do not claim a sub-bot did work unless the task/activity log shows it.
- Destructive actions (deleting bots, rooms, teams or tasks) create a pending approval. Tell the Lead to approve it in the command center, then call the same tool with its approval_id. Never claim a destructive action succeeded before it is approved and executed.
- Do not request danger-full-access from team bots. Keep work in the shared workspace; if full machine access is required, ask the Lead to change the DSH policy.
- If a tool call fails with “approval ... cancelled/unavailable”, do not retry it. Explain that DSH's approval answerer is unavailable and ask the Lead to switch the DSH session to full access or use a shell-capable workspace.
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
    this.timeoutMs = Number.isInteger(options.timeoutMs) ? options.timeoutMs : 900_000
    this.mainTimeoutMs = Number.isInteger(options.mainTimeoutMs) ? options.mainTimeoutMs : 1_800_000
    this.pollMs = Number.isInteger(options.pollMs) ? options.pollMs : 600
    this.workspaceRoot = String(options.workspaceRoot ?? '').trim()
    this.chains = new Map()
    this.active = new Map()
    this.modelApplied = new Map()
  }

  /** @returns {number} the wall-clock budget for one turn of this bot. */
  timeoutFor(bot) {
    return bot?.isMain === true ? this.mainTimeoutMs : this.timeoutMs
  }

  /** @returns {number} the longest budget any single turn can use; HTTP callers wait this long. */
  get maxTimeoutMs() {
    return Math.max(this.timeoutMs, this.mainTimeoutMs)
  }

  /** Resolve and create the isolated workspace for one task. */
  async ensureTaskWorkspace(taskId) {
    const root = this.workspaceRoot !== '' ? this.workspaceRoot : path.join(this.store.root, 'workspace')
    const dir = path.join(root, 'tasks', String(taskId))
    await mkdir(dir, { recursive: true })
    return dir
  }

  /**
   * Resolve one artifact against a task workspace and reject paths outside it.
   * @returns {Promise<{ absolute: string, relative: string }>}
   */
  async resolveTaskArtifact(taskId, artifactPath) {
    const workspace = await this.ensureTaskWorkspace(taskId)
    const raw = String(artifactPath ?? '').trim()
    if (raw === '') throw new Error('artifact path is required')
    const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(workspace, raw)
    const relative = path.relative(workspace, absolute)
    if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('artifact must stay inside the task workspace')
    }
    return { absolute, relative }
  }

  /** @returns {Promise<object[]>} current Session events. */
  async events(sessionId, signal) {
    const snapshot = await this.ctx.sessionController.inspect(sessionId, signal)
    return snapshot.events ?? []
  }

  /**
   * Bind the profile's configured model to one Session. Applied once per
   * Session per process, and again when the profile setting changes; an empty
   * setting leaves the Session on its default model.
   * @param {object} bot - the bot profile carrying `model`.
   * @param {string} sessionId - the Session the next turn runs in.
   * @returns {Promise<void>}
   */
  async applyModel(bot, sessionId) {
    const ref = String(bot.model ?? '').trim()
    const applied = this.modelApplied.get(sessionId) ?? ''
    if (ref === applied) return
    if (ref === '') {
      this.modelApplied.set(sessionId, '')
      return
    }
    const selection = parseModelRef(ref)
    try {
      await this.ctx.sessionController.selectModel({
        sessionId,
        provider: selection.provider,
        model: selection.model,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`bot ${bot.name}: cannot use model "${ref}": ${reason}`)
    }
    this.modelApplied.set(sessionId, ref)
  }

  /** @returns {string} the Session id stored for this turn, or '' when none is bound yet. */
  storedSession(bot, options = {}) {
    if (options.taskSession === true && typeof options.taskId === 'string' && options.taskId !== '') {
      return bot.taskSessions?.[options.taskId] ?? ''
    }
    return typeof bot.sessionId === 'string' ? bot.sessionId : ''
  }

  /** Remember one Session id for the profile, keyed by task when the turn belongs to one. */
  rememberSession(bot, sessionId, options = {}) {
    if (options.taskSession === true && typeof options.taskId === 'string' && options.taskId !== '') {
      const order = Array.isArray(bot.taskSessionOrder)
        ? bot.taskSessionOrder.filter((id) => id !== options.taskId)
        : []
      order.push(options.taskId)
      const sessions = { ...(bot.taskSessions ?? {}), [options.taskId]: sessionId }
      while (order.length > 30) delete sessions[order.shift()]
      bot.taskSessions = sessions
      bot.taskSessionOrder = order
      return
    }
    bot.sessionId = sessionId
  }

  /**
   * Resolve or create the Session this turn runs in. Room and private turns share
   * one long-lived Session; every task gets its own Session, so a second review
   * task cannot anchor on the first one's answer.
   */
  async ensureSession(bot, signal, options = {}) {
    const stored = this.storedSession(bot, options)
    if (stored !== '') {
      let live = false
      try {
        const resolved = await this.ctx.sessionController.resolveAgent(stored)
        live = resolved?.agent !== undefined
      } catch {
        // A deleted or unreadable Session falls through to a new one.
      }
      if (live) {
        await this.applyModel(bot, stored)
        return stored
      }
    }
    const cwd = typeof options.workspace === 'string' && options.workspace !== ''
      ? options.workspace
      : typeof bot.workspace === 'string' && bot.workspace !== ''
        ? bot.workspace
        : this.workspaceRoot
    const created = await this.ctx.sessionController.create({
      ...(cwd === '' ? {} : { cwd }),
    })
    this.rememberSession(bot, created.sessionId, options)
    await this.store.save()
    await this.applyModel(bot, created.sessionId)
    return created.sessionId
  }

  /**
   * Ask one bot one turn and return its assistant text.
   * Calls for the same bot serialize so two room messages cannot interleave.
   * @param {object} bot
   * @param {string} prompt
   * @param {AbortSignal} [signal]
   * @param {{ taskId?: string, roomId?: string, autoStart?: boolean, workspace?: string }} [context]
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
      const resultText = textOf(data.message?.content)
      const failureText = compact(
        String(data.error?.reason ?? data.error?.message ?? resultText),
      )
      if (taskId !== '' && callId !== '') {
        try {
          await this.store.finishTaskStep(taskId, callId, {
            status: failed ? 'error' : 'done',
            detail: failed ? failureText : '',
          })
        } catch {
          // Ignore missing task/step after a restart.
        }
      }
      try {
        await this.store.finishActivity(callId, {
          status: failed ? 'error' : 'done',
          detail: failed ? failureText : '',
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
        detail: failed ? failureText : '',
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
    const budget = this.timeoutFor(bot)
    const controller = new AbortController()
    const fused = signal === undefined ? controller.signal : AbortSignal.any([signal, controller.signal])
    const taskId = String(context.taskId ?? '')
    const sessionId = await this.ensureSession(bot, fused, {
      taskSession: context.taskSession === true,
      taskId,
    })
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
    let ended = false
    let lastEventAt = Date.now()
    let toolRunning = false
    let stallNotified = false
    let delegationDepth = 0
    let timedOut = false
    let timer
    const arm = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timedOut = true
        try {
          this.ctx.sessionController.cancel({ sessionId })
        } catch {
          // The turn may have already settled.
        }
        controller.abort(new Error(`team-bot turn timed out after ${budget}ms`))
      }, budget)
      timer.unref?.()
    }
    const pause = () => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
    }
    arm()
    try {
      await this.ctx.sessionController.prompt(
        {
          requestId: `team-bot-${randomUUID()}`,
          sessionId,
          mode: 'queue',
          content: [{ type: 'text', text: prompt }],
        },
        fused,
      )
      let assistantText = ''
      while (!fused.aborted) {
        await sleep(this.pollMs, fused)
        const events = await this.events(sessionId, fused)
        const fresh = events.filter((event) => event.seq > lastSeq)
        if (fresh.length > 0) {
          lastEventAt = Date.now()
          stallNotified = false
        }
        for (const event of fresh) {
          lastSeq = event.seq
          if (event.type === 'tool/call') {
            toolRunning = true
            if (DELEGATION_TOOLS.has(String(event.data?.name ?? ''))) {
              delegationDepth += 1
              pause()
            }
          }
          if (event.type === 'tool/result') {
            toolRunning = false
            if (delegationDepth > 0) {
              delegationDepth -= 1
              if (delegationDepth === 0) arm()
            }
          }
          if (event.type === 'assistant/message' || event.type === 'turn/end') {
            toolRunning = false
          }
          await this.handleEvent(bot, event, { taskId })
          if (event.type === 'assistant/message') {
            const text = textOf(event.data?.message?.content)
            if (text !== '') assistantText = text
          }
          if (event.type === 'turn/end') {
            ended = true
            return assistantText
          }
        }
        if (toolRunning && !stallNotified && Date.now() - lastEventAt > 60_000) {
          stallNotified = true
          await this.presence(bot, { status: 'waiting', action: '工具长时间未返回，可能在等待授权', taskId })
          await this.activity({
            botId: bot.id,
            taskId,
            kind: 'watchdog',
            label: '工具长时间未返回',
            detail: '可能在等待 DSH 授权或外部进程；可在指挥台停止回合。',
            status: 'error',
          })
        }
      }
      throw new Error('team-bot turn aborted')
    } catch (error) {
      if (timedOut) throw new Error(`team-bot turn timed out after ${budget}ms`)
      throw error
    } finally {
      pause()
      this.active.delete(bot.id)
      if (!ended) {
        await this.presence(bot, { status: 'blocked', action: '回合中断', taskId: '' })
      }
    }
  }
}

/** Resolve the shared workspace directory used when a bot has no explicit cwd. */
export function defaultWorkspace(dataDir) {
  return path.join(dataDir, 'workspace')
}
