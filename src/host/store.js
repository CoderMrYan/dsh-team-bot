/**
 * Durable room store for dsh-team-bot.
 *
 * Layout under `root`:
 *   state.json                 rooms, bots, seq
 *   messages/<roomId>.jsonl    append-only room timeline
 *   memory/room/<roomId>.json  shared memory (P3)
 *   memory/bot/<botId>.json    per-bot memory (P3)
 */
import { appendFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { routeMessage } from './routing.js'
import { defaultMemory, mergeAtoms, normalizeMemory } from './memory.js'
import { createAvatar } from './avatars.js'

const STATE_VERSION = 2
const REPLY_MODES = new Set(['mention', 'admin', 'auto'])
const TASK_STATUSES = new Set(['queued', 'running', 'waiting', 'blocked', 'done', 'failed'])
const PRESENCE_STATUSES = new Set(['idle', 'thinking', 'tool', 'waiting', 'blocked', 'offline'])

/** @returns {string} a short stable-looking identifier. */
function newId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

/** @returns {number} `value` clamped into [min, max], or `fallback` when not an integer. */
function clampInt(value, min, max, fallback) {
  if (!Number.isInteger(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** @returns {object} a validated room policy with defaults. */
export function normalizePolicy(input = {}) {
  return {
    replyMode: REPLY_MODES.has(input.replyMode) ? input.replyMode : 'mention',
    maxSpeakers: clampInt(input.maxSpeakers, 1, 8, 3),
    hopLimit: clampInt(input.hopLimit, 0, 5, 2),
    allowPass: input.allowPass !== false,
  }
}

/** @returns {object} an empty durable state. */
function emptyState() {
  return {
    version: STATE_VERSION,
    seq: 0,
    bots: {},
    rooms: {},
    directs: {},
    tasks: {},
    activities: [],
    presence: {},
    main: { botId: '', roomId: '' },
  }
}

export class TeamStore {
  /** @param {string} root - absolute data directory. */
  constructor(root) {
    this.root = root
    this.state = emptyState()
    this.loaded = false
    this.writeChain = Promise.resolve()
  }

  /** Load state from disk once. */
  async init() {
    if (this.loaded) return
    await mkdir(this.root, { recursive: true })
    try {
      const raw = JSON.parse(await readFile(this.statePath(), 'utf8'))
      this.state = {
        version: STATE_VERSION,
        seq: Number.isSafeInteger(raw.seq) ? raw.seq : 0,
        bots: raw.bots ?? {},
        rooms: raw.rooms ?? {},
        directs: raw.directs ?? {},
        tasks: raw.tasks ?? {},
        activities: Array.isArray(raw.activities) ? raw.activities : [],
        presence: raw.presence ?? {},
        main: {
          botId: String(raw.main?.botId ?? ''),
          roomId: String(raw.main?.roomId ?? ''),
        },
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.state = emptyState()
    }
    for (const bot of Object.values(this.state.bots)) {
      bot.teamId = String(bot.teamId ?? '')
      bot.teamName = String(bot.teamName ?? '')
      bot.isMain = bot.isMain === true
      bot.title = String(bot.title ?? '')
      if (bot.avatar === undefined) bot.avatar = createAvatar(bot.name, 'bot')
    }
    for (const room of Object.values(this.state.rooms)) {
      room.teamId = String(room.teamId ?? '')
      room.teamName = String(room.teamName ?? '')
      if (room.avatar === undefined) room.avatar = createAvatar(room.name, 'room')
    }
    this.loaded = true
  }

  /** @returns {string} */
  statePath() {
    return path.join(this.root, 'state.json')
  }

  /** @param {string} roomId */
  messagesPath(roomId) {
    return path.join(this.root, 'messages', `${roomId}.jsonl`)
  }

  /** Persist state without interleaving concurrent writes. */
  async save() {
    const snapshot = JSON.stringify(this.state, null, 2)
    const target = this.statePath()
    const temp = `${target}.tmp`
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(this.root, { recursive: true })
      await writeFile(temp, snapshot, 'utf8')
      await rm(target, { force: true })
      await rename(temp, target)
    })
    return this.writeChain
  }

  /** @returns {object[]} */
  listBots(options = {}) {
    const all = Object.values(this.state.bots)
    return options.includeHidden === true ? all : all.filter((bot) => bot.hidden !== true)
  }

  /** @param {string} botId */
  getBot(botId) {
    const bot = this.state.bots[botId]
    if (bot === undefined) throw new Error(`unknown bot: ${botId}`)
    return bot
  }

  /** @param {string} name */
  assertBotNameFree(name) {
    const hit = this.listBots().find((bot) => bot.name.toLowerCase() === name.toLowerCase())
    if (hit !== undefined) throw new Error(`bot name already used: ${name}`)
  }

  /**
   * Create one named bot profile. A bot is a profile, not yet a live Session:
   * P1 binds each profile to a real DSH Session.
   */
  async createBot(input) {
    await this.init()
    const name = String(input.name ?? '').trim()
    if (name === '') throw new Error('bot name is required')
    const isMain = input.isMain === true
    if (isMain) {
      for (const existing of Object.values(this.state.bots)) existing.isMain = false
    }
    const bot = {
      id: newId('bot'),
      name,
      role: String(input.role ?? '').trim(),
      title: String(input.title ?? '').trim(),
      persona: String(input.persona ?? '').trim(),
      model: String(input.model ?? '').trim(),
      workspace: String(input.workspace ?? '').trim(),
      teamId: String(input.teamId ?? ''),
      teamName: String(input.teamName ?? ''),
      isMain,
      hidden: input.hidden === true,
      avatar: input.avatar ?? createAvatar(name, 'bot'),
      sessionId: '',
      createdAt: new Date().toISOString(),
    }
    this.state.bots[bot.id] = bot
    if (isMain) this.state.main.botId = bot.id
    await this.save()
    return bot
  }

  /** @returns {object|undefined} the current main bot, if one exists. */
  getMainBot() {
    return this.state.bots[this.state.main.botId]
      ?? Object.values(this.state.bots).find((bot) => bot.isMain === true)
  }

  /** Create the main bot on first use; the id is stable across restarts. */
  async ensureMainBot(input = {}) {
    await this.init()
    let main = this.getMainBot()
    if (main !== undefined) {
      this.state.main.botId = main.id
      return main
    }
    main = await this.createBot({
      name: input.name ?? '主 Bot',
      role: input.role ?? '总指挥 / Orchestrator',
      title: input.title ?? '主 Bot',
      persona: input.persona ?? '',
      isMain: true,
      hidden: false,
    })
    this.state.main.botId = main.id
    await this.save()
    return main
  }

  /** @returns {object} a task record with defaults. */
  normalizeTask(task) {
    return {
      ...task,
      status: TASK_STATUSES.has(task.status) ? task.status : 'queued',
      progress: Number.isFinite(task.progress) ? Math.max(0, Math.min(100, task.progress)) : 0,
      steps: Array.isArray(task.steps) ? task.steps : [],
      artifacts: Array.isArray(task.artifacts) ? task.artifacts : [],
      currentStep: String(task.currentStep ?? ''),
      ownerBotId: String(task.ownerBotId ?? ''),
      roomId: String(task.roomId ?? ''),
      teamId: String(task.teamId ?? ''),
      parentId: String(task.parentId ?? ''),
      createdBy: String(task.createdBy ?? 'human'),
    }
  }

  /** Create one durable task. */
  async createTask(input = {}) {
    await this.init()
    const title = String(input.title ?? '').trim()
    if (title === '') throw new Error('task title is required')
    const ownerBotId = String(input.ownerBotId ?? '')
    if (ownerBotId !== '') this.getBot(ownerBotId)
    const task = this.normalizeTask({
      id: newId('task'),
      title,
      brief: String(input.brief ?? '').trim(),
      ownerBotId,
      roomId: String(input.roomId ?? ''),
      teamId: String(input.teamId ?? ''),
      parentId: String(input.parentId ?? ''),
      createdBy: String(input.createdBy ?? 'human'),
      status: TASK_STATUSES.has(input.status) ? input.status : 'queued',
      progress: input.progress,
      currentStep: '',
      steps: [],
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    this.state.tasks[task.id] = task
    await this.save()
    return task
  }

  /** @returns {object[]} tasks, newest update first. */
  listTasks(filter = {}) {
    let tasks = Object.values(this.state.tasks).map((task) => this.normalizeTask(task))
    if (typeof filter.ownerBotId === 'string' && filter.ownerBotId !== '') {
      tasks = tasks.filter((task) => task.ownerBotId === filter.ownerBotId)
    }
    if (typeof filter.roomId === 'string' && filter.roomId !== '') {
      tasks = tasks.filter((task) => task.roomId === filter.roomId)
    }
    if (typeof filter.parentId === 'string' && filter.parentId !== '') {
      tasks = tasks.filter((task) => task.parentId === filter.parentId)
    }
    if (Array.isArray(filter.status) && filter.status.length > 0) {
      const allowed = new Set(filter.status)
      tasks = tasks.filter((task) => allowed.has(task.status))
    } else if (typeof filter.status === 'string' && filter.status !== '') {
      tasks = tasks.filter((task) => task.status === filter.status)
    }
    return tasks.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
  }

  /** @param {string} taskId */
  getTask(taskId) {
    const task = this.state.tasks[taskId]
    if (task === undefined) throw new Error(`unknown task: ${taskId}`)
    return this.normalizeTask(task)
  }

  /** Update task fields and touch its timestamp. */
  async updateTask(taskId, patch = {}) {
    await this.init()
    const task = this.state.tasks[taskId]
    if (task === undefined) throw new Error(`unknown task: ${taskId}`)
    if (patch.title !== undefined) task.title = String(patch.title)
    if (patch.brief !== undefined) task.brief = String(patch.brief)
    if (patch.ownerBotId !== undefined) {
      const owner = String(patch.ownerBotId)
      if (owner !== '') this.getBot(owner)
      task.ownerBotId = owner
    }
    if (patch.roomId !== undefined) task.roomId = String(patch.roomId)
    if (patch.status !== undefined) {
      if (!TASK_STATUSES.has(patch.status)) throw new Error(`invalid task status: ${patch.status}`)
      task.status = patch.status
      if (patch.status === 'running' && task.startedAt === undefined) task.startedAt = new Date().toISOString()
      if (['done', 'failed'].includes(patch.status)) task.completedAt = new Date().toISOString()
    }
    if (patch.progress !== undefined) {
      const progress = Number(patch.progress)
      if (!Number.isFinite(progress)) throw new Error('task progress must be a number')
      task.progress = Math.max(0, Math.min(100, progress))
    }
    if (patch.currentStep !== undefined) task.currentStep = String(patch.currentStep)
    if (patch.artifacts !== undefined) task.artifacts = Array.isArray(patch.artifacts) ? patch.artifacts : task.artifacts
    task.updatedAt = new Date().toISOString()
    await this.save()
    return this.normalizeTask(task)
  }

  /**
   * Append a step to a task. `persist=false` lets a caller batch a task step and
   * a global activity row into one state write.
   */
  async addTaskStep(taskId, step = {}, persist = true) {
    await this.init()
    const task = this.state.tasks[taskId]
    if (task === undefined) throw new Error(`unknown task: ${taskId}`)
    if (!Array.isArray(task.steps)) task.steps = []
    const entry = {
      id: String(step.id ?? newId('step')),
      kind: String(step.kind ?? 'note'),
      label: String(step.label ?? ''),
      detail: String(step.detail ?? ''),
      status: String(step.status ?? 'done'),
      callId: String(step.callId ?? ''),
      ts: String(step.ts ?? new Date().toISOString()),
    }
    task.steps.push(entry)
    if (task.steps.length > 240) task.steps.splice(0, task.steps.length - 240)
    if (entry.label !== '') task.currentStep = entry.label
    if (entry.status === 'running') {
      task.status = 'running'
      if (task.startedAt === undefined) task.startedAt = entry.ts
    }
    task.updatedAt = entry.ts
    if (persist) await this.save()
    return entry
  }

  /** Register one artifact path on a task. */
  async addTaskArtifact(taskId, artifact = {}) {    await this.init()
    const task = this.state.tasks[taskId]
    if (task === undefined) throw new Error(`unknown task: ${taskId}`)
    if (!Array.isArray(task.artifacts)) task.artifacts = []
    const entry = {
      name: String(artifact.name ?? ''),
      path: String(artifact.path ?? ''),
      ts: String(artifact.ts ?? new Date().toISOString()),
    }
    task.artifacts.push(entry)
    task.updatedAt = entry.ts
    await this.save()
    return entry
  }

  /** Close the tool step matching one callId, if it is still open. */
  async finishTaskStep(taskId, callId, patch = {}) {    await this.init()
    const task = this.state.tasks[taskId]
    if (task === undefined) return undefined
    const steps = Array.isArray(task.steps) ? task.steps : []
    const matching = steps.filter((entry) => entry.callId === callId)
    if (matching.length === 0) return undefined
    for (const step of matching) {
      step.status = String(patch.status ?? 'done')
      if (patch.detail !== undefined) step.detail = String(patch.detail)
      step.ts = new Date().toISOString()
    }
    task.updatedAt = matching.at(-1).ts
    await this.save()
    return matching.at(-1)
  }

  /** Close every still-running step of one kind (for example the run step on turn end). */
  async finishOpenTaskSteps(taskId, status = 'done', detail = '', kind = '') {
    await this.init()
    const task = this.state.tasks[taskId]
    if (task === undefined) return 0
    const steps = Array.isArray(task.steps) ? task.steps : []
    let changed = 0
    for (const step of steps) {
      if (step.status !== 'running') continue
      if (kind !== '' && step.kind !== kind) continue
      step.status = status
      if (detail !== '') step.detail = detail
      step.ts = new Date().toISOString()
      changed += 1
    }
    if (changed > 0) {
      task.updatedAt = new Date().toISOString()
      await this.save()
    }
    return changed
  }

  /** Append one global activity row; task-linked rows also become task steps. */
  async recordActivity(input = {}) {
    await this.init()
    const at = String(input.ts ?? new Date().toISOString())
    const activity = {
      id: newId('act'),
      botId: String(input.botId ?? ''),
      taskId: String(input.taskId ?? ''),
      kind: String(input.kind ?? 'note'),
      label: String(input.label ?? ''),
      detail: String(input.detail ?? ''),
      status: String(input.status ?? 'done'),
      callId: String(input.callId ?? ''),
      ts: at,
    }
    this.state.activities.push(activity)
    if (this.state.activities.length > 1200) {
      this.state.activities.splice(0, this.state.activities.length - 1200)
    }
    if (activity.taskId !== '' && this.state.tasks[activity.taskId] !== undefined) {
      const task = this.state.tasks[activity.taskId]
      if (!Array.isArray(task.steps)) task.steps = []
      task.steps.push({
        id: newId('step'),
        kind: activity.kind,
        label: activity.label,
        detail: activity.detail,
        status: activity.status,
        callId: activity.callId,
        ts: at,
      })
      if (task.steps.length > 240) task.steps.splice(0, task.steps.length - 240)
      if (activity.label !== '') task.currentStep = activity.label
      task.updatedAt = at
    }
    await this.save()
    return activity
  }

  /** @returns {object[]} recent activity, newest last. */
  listActivity(filter = {}) {
    const limit = clampInt(filter.limit, 1, 500, 100)
    return this.state.activities
      .filter((activity) => filter.botId === undefined || activity.botId === filter.botId)
      .filter((activity) => filter.taskId === undefined || activity.taskId === filter.taskId)
      .slice(-limit)
  }

  /** Persist one bot presence snapshot. */
  async setPresence(botId, patch = {}) {
    await this.init()
    this.getBot(botId)
    const current = this.state.presence[botId] ?? { botId, status: 'idle', taskId: '', action: '', updatedAt: '' }
    const status = PRESENCE_STATUSES.has(patch.status) ? patch.status : current.status
    this.state.presence[botId] = {
      botId,
      status,
      taskId: patch.taskId === undefined ? current.taskId : String(patch.taskId),
      action: patch.action === undefined ? current.action : String(patch.action),
      updatedAt: new Date().toISOString(),
    }
    await this.save()
    return this.state.presence[botId]
  }

  /** @returns {object[]} all bot presence rows, with idle defaults. */
  listPresence() {
    return Object.values(this.state.bots).map((bot) => this.state.presence[bot.id] ?? {
      botId: bot.id,
      status: bot.hidden === true ? 'offline' : 'idle',
      taskId: '',
      action: '',
      updatedAt: bot.createdAt ?? '',
    })
  }

  /** @returns {object[]} */
  listRooms() {
    return Object.values(this.state.rooms)
  }

  /** @param {string} roomId */
  getRoom(roomId) {
    const room = this.state.rooms[roomId]
    if (room === undefined) throw new Error(`unknown room: ${roomId}`)
    return room
  }

  /** @param {string} name */
  assertRoomNameFree(name) {
    const hit = this.listRooms().find((room) => room.name.toLowerCase() === name.toLowerCase())
    if (hit !== undefined) throw new Error(`room name already used: ${name}`)
  }

  /** Create one shared room. The chief defaults to the first member. */
  async createRoom(input) {
    await this.init()
    const name = String(input.name ?? '').trim()
    if (name === '') throw new Error('room name is required')
    this.assertRoomNameFree(name)
    const members = [...new Set((input.members ?? []).map(String))]
    for (const memberId of members) this.getBot(memberId)
    const chiefId = String(input.chiefId ?? '').trim()
    if (chiefId !== '' && !members.includes(chiefId)) throw new Error(`chief is not a room member: ${chiefId}`)
    const room = {
      id: newId('room'),
      name,
      members,
      chiefId: chiefId !== '' ? chiefId : (members[0] ?? ''),
      policy: normalizePolicy(input.policy ?? {}),
      note: '',
      teamId: String(input.teamId ?? ''),
      teamName: String(input.teamName ?? ''),
      avatar: input.avatar ?? createAvatar(name, 'room'),
      createdAt: new Date().toISOString(),
    }
    this.state.rooms[room.id] = room
    await this.save()
    return room
  }

  /** Update a room's members, chief, or policy. */
  async updateRoom(roomId, patch = {}) {
    await this.init()
    const room = this.getRoom(roomId)
    if (patch.members !== undefined) {
      const members = [...new Set((patch.members ?? []).map(String))]
      if (members.length === 0) throw new Error('room needs at least one member')
      for (const memberId of members) this.getBot(memberId)
      room.members = members
      if (!members.includes(room.chiefId)) room.chiefId = members[0]
    }
    if (patch.chiefId !== undefined) {
      const chiefId = String(patch.chiefId)
      if (!room.members.includes(chiefId)) throw new Error(`chief is not a room member: ${chiefId}`)
      room.chiefId = chiefId
    }
    if (patch.policy !== undefined) room.policy = normalizePolicy({ ...room.policy, ...patch.policy })
    await this.save()
    return room
  }

  /** Delete one room and its timeline/memory files. */
  async deleteRoom(roomId) {
    await this.init()
    this.getRoom(roomId)
    delete this.state.rooms[roomId]
    await this.save()
    await rm(this.messagesPath(roomId), { force: true }).catch(() => undefined)
    await rm(this.memoryPath('room', roomId), { force: true }).catch(() => undefined)
    return { roomId }
  }

  /** Rename a team and its main room. */
  async renameTeam(teamId, name) {
    await this.init()
    this.assertTeam(teamId)
    const next = String(name ?? '').trim()
    if (next === '') throw new Error('team name is required')
    const rooms = Object.values(this.state.rooms).filter((room) => room.teamId === String(teamId))
    const oldName = rooms[0]?.teamName || rooms[0]?.name || ''
    const main = rooms.find((room) => room.name === oldName)
    const conflict = Object.values(this.state.rooms).some((room) => room.id !== main?.id
      && room.name.toLowerCase() === next.toLowerCase())
    if (conflict) throw new Error(`room name already used: ${next}`)
    for (const room of rooms) {
      room.teamName = next
      if (room.name === oldName) room.name = next
    }
    for (const bot of Object.values(this.state.bots)) {
      if (bot.teamId === String(teamId)) bot.teamName = next
    }
    await this.save()
    return { teamId: String(teamId), name: next, roomIds: rooms.map((room) => room.id) }
  }

  /** Delete every room and bot that belongs to one team. */
  async deleteTeam(teamId) {
    await this.init()
    const id = String(teamId ?? '')
    if (id === '') throw new Error('team id is required')
    const roomIds = Object.values(this.state.rooms).filter((room) => room.teamId === id).map((room) => room.id)
    const botIds = Object.values(this.state.bots).filter((bot) => bot.teamId === id).map((bot) => bot.id)
    for (const roomId of roomIds) delete this.state.rooms[roomId]
    for (const botId of botIds) delete this.state.bots[botId]
    await this.save()
    for (const roomId of roomIds) {
      await rm(this.messagesPath(roomId), { force: true }).catch(() => undefined)
      await rm(this.memoryPath('room', roomId), { force: true }).catch(() => undefined)
    }
    for (const botId of botIds) {
      await rm(this.memoryPath('bot', botId), { force: true }).catch(() => undefined)
    }
    return { teamId: id, roomIds, botIds }
  }

  /**
   * Append one message and compute who should answer it.
   * @param {{roomId:string, sender:{type:'human'|'bot', id?:string, name:string}, text:string, mentions?:string[]}} input
   */
  async postMessage(input) {
    await this.init()
    const room = this.getRoom(input.roomId)
    const text = String(input.text ?? '').trim()
    if (text === '') throw new Error('message text is required')
    const sender = {
      type: input.sender?.type === 'bot' ? 'bot' : 'human',
      id: String(input.sender?.id ?? ''),
      name: String(input.sender?.name ?? (input.sender?.type === 'bot' ? 'bot' : 'human')),
    }
    if (sender.type === 'bot') this.getBot(sender.id)
    const mentions = [...new Set((input.mentions ?? []).map(String))].filter((id) => room.members.includes(id))
    const message = {
      id: newId('msg'),
      roomId: room.id,
      seq: this.state.seq + 1,
      sender,
      text,
      mentions,
      ts: new Date().toISOString(),
    }
    this.state.seq = message.seq
    await mkdir(path.dirname(this.messagesPath(room.id)), { recursive: true })
    await appendFile(this.messagesPath(room.id), `${JSON.stringify(message)}\n`, 'utf8')
    await this.save()
    return { message, routed: routeMessage(room, message, this.state.bots) }
  }

  /** Read the latest `limit` messages, oldest first. */
  async history(roomId, limit = 50) {
    await this.init()
    this.getRoom(roomId)
    const safeLimit = clampInt(limit, 1, 500, 50)
    let raw = ''
    try {
      raw = await readFile(this.messagesPath(roomId), 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    return raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(-safeLimit)
      .map((line) => JSON.parse(line))
  }

  /** @returns {string} absolute JSONL path for one direct conversation. */
  directPath(botId) {
    return path.join(this.root, 'messages', `dm-${botId}.jsonl`)
  }

  /** Append one direct message and return it. */
  async postDirect(input) {
    await this.init()
    const bot = this.getBot(input.botId)
    const text = String(input.text ?? '').trim()
    if (text === '') throw new Error('direct message text is required')
    const sender = {
      type: input.sender?.type === 'bot' ? 'bot' : 'human',
      id: String(input.sender?.id ?? ''),
      name: String(input.sender?.name ?? (input.sender?.type === 'bot' ? bot.name : 'human')),
    }
    const message = {
      id: newId('dm'),
      kind: 'direct',
      botId: bot.id,
      seq: this.state.seq + 1,
      sender,
      text,
      ts: new Date().toISOString(),
    }
    this.state.seq = message.seq
    const current = this.state.directs[bot.id] ?? { botId: bot.id, count: 0, lastAt: message.ts }
    this.state.directs[bot.id] = { botId: bot.id, count: current.count + 1, lastAt: message.ts }
    await mkdir(path.dirname(this.directPath(bot.id)), { recursive: true })
    await appendFile(this.directPath(bot.id), `${JSON.stringify(message)}\n`, 'utf8')
    await this.save()
    return message
  }

  /** Read the latest direct messages, oldest first. */
  async directHistory(botId, limit = 50) {
    await this.init()
    this.getBot(botId)
    const safeLimit = clampInt(limit, 1, 500, 50)
    let raw = ''
    try {
      raw = await readFile(this.directPath(botId), 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    return raw
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(-safeLimit)
      .map((line) => JSON.parse(line))
  }

  /** List direct conversations with their bot profile. */
  listDirects() {
    return Object.values(this.state.directs).map((direct) => ({
      ...direct,
      bot: this.state.bots[direct.botId],
    }))
  }

  /** Replace one bot's private summary. */
  async setBotSummary(botId, summary) {
    const memory = await this.botMemory(botId)
    memory.summary = String(summary ?? '').slice(0, 1200)
    return await this.saveMemory('bot', botId, memory)
  }

  /** Read shared team memory. */
  async teamMemory(teamId) {
    await this.init()
    this.assertTeam(teamId)
    return normalizeMemory(await this.readJson(this.memoryPath('team', teamId), defaultMemory()))
  }

  /** @param {string} teamId */
  assertTeam(teamId) {
    const id = String(teamId ?? '')
    if (id === '') throw new Error('team id is required')
    const exists = Object.values(this.state.rooms).some((room) => room.teamId === id)
      || Object.values(this.state.bots).some((bot) => bot.teamId === id)
    if (!exists) throw new Error(`unknown team: ${id}`)
  }

  /** Add or supersede one team-wide atom. */
  async rememberTeam(teamId, atom) {
    const memory = await this.teamMemory(teamId)
    const merged = mergeAtoms(memory.atoms, atom)
    memory.atoms = merged.atoms
    await this.saveMemory('team', teamId, memory)
    return { memory, ...merged }
  }

  /** Remove one team-wide atom. */
  async forgetTeam(teamId, atomId) {
    const memory = await this.teamMemory(teamId)
    memory.atoms = memory.atoms.filter((atom) => atom.id !== atomId)
    return await this.saveMemory('team', teamId, memory)
  }

  /** Accept, reject or re-open one team-wide atom. */
  async reviewTeam(teamId, atomId, review) {
    return await this.reviewMemory('team', teamId, atomId, review)
  }

  /** Replace the team-wide summary. */
  async setTeamSummary(teamId, summary) {
    const memory = await this.teamMemory(teamId)
    memory.summary = String(summary ?? '').slice(0, 1200)
    return await this.saveMemory('team', teamId, memory)
  }

  /** Read shared room memory. */
  async roomMemory(roomId) {
    await this.init()
    this.getRoom(roomId)
    return normalizeMemory(await this.readJson(this.memoryPath('room', roomId), defaultMemory()))
  }

  /** Read one bot's private memory. */
  async botMemory(botId) {
    await this.init()
    this.getBot(botId)
    return normalizeMemory(await this.readJson(this.memoryPath('bot', botId), defaultMemory()))
  }

  /** @returns {string} absolute memory document path. */
  memoryPath(scope, id) {
    return path.join(this.root, 'memory', scope, `${id}.json`)
  }

  /** Persist one memory document. */
  async saveMemory(scope, id, memory) {
    memory.updatedAt = Date.now()
    await this.writeJson(this.memoryPath(scope, id), memory)
    return normalizeMemory(memory)
  }

  /** Add or supersede one shared atom. */
  async rememberRoom(roomId, atom) {
    const memory = await this.roomMemory(roomId)
    const merged = mergeAtoms(memory.atoms, atom)
    memory.atoms = merged.atoms
    await this.saveMemory('room', roomId, memory)
    return { memory, ...merged }
  }

  /** Add or supersede one private atom. */
  async rememberBot(botId, atom) {
    const memory = await this.botMemory(botId)
    const merged = mergeAtoms(memory.atoms, atom)
    memory.atoms = merged.atoms
    await this.saveMemory('bot', botId, memory)
    return { memory, ...merged }
  }

  /** Remove one shared atom. */
  async forgetRoom(roomId, atomId) {
    const memory = await this.roomMemory(roomId)
    memory.atoms = memory.atoms.filter((atom) => atom.id !== atomId)
    return await this.saveMemory('room', roomId, memory)
  }

  /** Remove one private atom. */
  async forgetBot(botId, atomId) {
    const memory = await this.botMemory(botId)
    memory.atoms = memory.atoms.filter((atom) => atom.id !== atomId)
    return await this.saveMemory('bot', botId, memory)
  }

  /** Accept, reject or re-open one shared atom. */
  async reviewRoom(roomId, atomId, review) {
    return await this.reviewMemory('room', roomId, atomId, review)
  }

  /** Accept, reject or re-open one private atom. */
  async reviewBot(botId, atomId, review) {
    return await this.reviewMemory('bot', botId, atomId, review)
  }

  /** @returns {Promise<object>} the updated memory document. */
  async reviewMemory(scope, id, atomId, review) {
    if (review !== 'accepted' && review !== 'rejected' && review !== 'pending') {
      throw new Error(`invalid review state: ${review}`)
    }
    const memory = scope === 'bot'
      ? await this.botMemory(id)
      : scope === 'team'
        ? await this.teamMemory(id)
        : await this.roomMemory(id)
    const atom = memory.atoms.find((item) => item.id === atomId)
    if (atom === undefined) throw new Error(`unknown memory atom: ${atomId}`)
    atom.review = review
    return await this.saveMemory(scope, id, memory)
  }

  /** Replace the shared extractive summary. */
  async setRoomSummary(roomId, summary) {
    const memory = await this.roomMemory(roomId)
    memory.summary = String(summary ?? '').slice(0, 1200)
    return await this.saveMemory('room', roomId, memory)
  }

  /** Add one standing preference to a bot's private memory. */
  async addPersona(botId, item) {
    const memory = await this.botMemory(botId)
    memory.persona = [...memory.persona.filter((entry) => entry.text !== item.text), item].slice(-12)
    return await this.saveMemory('bot', botId, memory)
  }

  /** @returns {Promise<object>} parsed JSON, or `fallback` when absent. */
  async readJson(file, fallback) {
    try {
      return JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') return fallback
      throw error
    }
  }

  /** Atomically write one JSON document. */
  async writeJson(file, value) {
    await mkdir(path.dirname(file), { recursive: true })
    const temp = `${file}.tmp`
    await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
    await rm(file, { force: true })
    await rename(temp, file)
  }
}
