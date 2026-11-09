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

const STATE_VERSION = 1
const REPLY_MODES = new Set(['mention', 'admin', 'auto'])

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
  return { version: STATE_VERSION, seq: 0, bots: {}, rooms: {} }
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
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      this.state = emptyState()
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

  /** @returns {object} */
  listBots() {
    return Object.values(this.state.bots)
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
    this.assertBotNameFree(name)
    const bot = {
      id: newId('bot'),
      name,
      role: String(input.role ?? '').trim(),
      persona: String(input.persona ?? '').trim(),
      model: String(input.model ?? '').trim(),
      workspace: String(input.workspace ?? '').trim(),
      sessionId: '',
      createdAt: new Date().toISOString(),
    }
    this.state.bots[bot.id] = bot
    await this.save()
    return bot
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
      createdAt: new Date().toISOString(),
    }
    this.state.rooms[room.id] = room
    await this.save()
    return room
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
    return { message, routed: routeMessage(room, message) }
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
