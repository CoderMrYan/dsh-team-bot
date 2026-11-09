import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore, normalizePolicy } from '../src/host/store.js'
import { routeMessage } from '../src/host/routing.js'

/** @returns {Promise<{store: TeamStore, dir: string}>} an isolated store. */
async function freshStore() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-'))
  const store = new TeamStore(dir)
  await store.init()
  return { store, dir }
}

/** @returns {Promise<{dir: string, room: object, bots: object[]}>} a room with three bots. */
async function freshRoom(policy = {}) {
  const { store, dir } = await freshStore()
  const a = await store.createBot({ name: 'alice', role: 'researcher' })
  const b = await store.createBot({ name: 'bob', role: 'writer' })
  const c = await store.createBot({ name: 'carol', role: 'reviewer' })
  const room = await store.createRoom({
    name: 'general',
    members: [a.id, b.id, c.id],
    chiefId: a.id,
    policy,
  })
  return { dir, store, room, bots: [a, b, c] }
}

test('create and list bots, allowing duplicate role names', async () => {
  const { store, dir } = await freshStore()
  try {
    const bot = await store.createBot({ name: 'alice', role: 'researcher', persona: 'find facts' })
    assert.equal(bot.name, 'alice')
    assert.equal(bot.avatar.hue >= 0, true)
    assert.equal(store.listBots().length, 1)
    const second = await store.createBot({ name: 'ALICE', role: 'dup' })
    assert.equal(second.name, 'ALICE')
    assert.notEqual(second.id, bot.id)
    assert.equal(store.listBots().length, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('room validates members and defaults its chief to the first member', async () => {
  const { store, dir } = await freshStore()
  try {
    const a = await store.createBot({ name: 'alice', role: 'researcher' })
    const b = await store.createBot({ name: 'bob', role: 'writer' })
    await assert.rejects(
      () => store.createRoom({ name: 'general', members: [a.id, 'bot-missing'] }),
      /unknown bot/,
    )
    const room = await store.createRoom({ name: 'general', members: [a.id, b.id] })
    assert.equal(room.chiefId, a.id)
    assert.deepEqual(room.members, [a.id, b.id])
    assert.equal(room.policy.replyMode, 'mention')
    assert.equal(room.policy.maxSpeakers, 3)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('updateRoom can move members and graft the same chief onto two rooms', async () => {
  const { store, dir } = await freshStore()
  try {
    const a = await store.createBot({ name: 'alice', role: 'chief' })
    const b = await store.createBot({ name: 'bob', role: 'member' })
    const c = await store.createBot({ name: 'carol', role: 'member' })
    const first = await store.createRoom({ name: 'first', members: [a.id, b.id], chiefId: a.id })
    const second = await store.createRoom({ name: 'second', members: [b.id, c.id], chiefId: b.id })
    const updated = await store.updateRoom(first.id, { members: [a.id, b.id, c.id], chiefId: c.id })
    assert.deepEqual(updated.members, [a.id, b.id, c.id])
    assert.equal(updated.chiefId, c.id)
    const grafted = await store.updateRoom(second.id, { chiefId: c.id })
    assert.equal(grafted.chiefId, c.id)
    await assert.rejects(() => store.updateRoom(second.id, { chiefId: a.id }), /not a room member/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('deleteRoom and deleteTeam remove their records', async () => {
  const { store, dir } = await freshStore()
  try {
    const a = await store.createBot({ name: 'a', teamId: 'team-x' })
    const b = await store.createBot({ name: 'b', teamId: 'team-x' })
    const first = await store.createRoom({ name: 'first', members: [a.id, b.id], teamId: 'team-x' })
    const second = await store.createRoom({ name: 'second', members: [a.id], teamId: 'team-x' })
    await store.deleteRoom(second.id)
    assert.equal(store.listRooms().some((room) => room.id === second.id), false)
    await store.deleteTeam('team-x')
    assert.equal(store.listRooms().some((room) => room.id === first.id), false)
    assert.equal(store.listBots().some((bot) => bot.id === a.id || bot.id === b.id), false)
    await assert.rejects(() => store.deleteTeam(''), /team id is required/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('mention routing wins, then admin, then auto', async () => {
  const { store, dir, room, bots } = await freshRoom({ replyMode: 'admin' })
  try {
    const [a, b, c] = bots
    const mention = await store.postMessage({
      roomId: room.id,
      sender: { type: 'human', name: 'human' },
      text: 'carol check this',
      mentions: [c.id],
    })
    assert.deepEqual(mention.routed, [c.id])

    const admin = await store.postMessage({
      roomId: room.id,
      sender: { type: 'human', name: 'human' },
      text: 'unaddressed',
    })
    assert.deepEqual(admin.routed, [a.id])

    const autoRoom = await store.createRoom({
      name: 'auto',
      members: [a.id, b.id, c.id],
      policy: { replyMode: 'auto', maxSpeakers: 2 },
    })
    const auto = await store.postMessage({
      roomId: autoRoom.id,
      sender: { type: 'human', name: 'human' },
      text: 'go',
    })
    assert.deepEqual(auto.routed, [a.id, b.id])

    const botOnly = await store.postMessage({
      roomId: autoRoom.id,
      sender: { type: 'bot', id: a.id, name: a.name },
      text: 'done, no handoff',
    })
    assert.deepEqual(botOnly.routed, [])

    const botHandoff = await store.postMessage({
      roomId: autoRoom.id,
      sender: { type: 'bot', id: a.id, name: a.name },
      text: 'carol, please review',
      mentions: [a.id, c.id],
    })
    assert.deepEqual(botHandoff.routed, [c.id])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('routing drops mentions outside the room and caps speakers', () => {
  const room = { members: ['a', 'b'], chiefId: 'a', policy: normalizePolicy({ maxSpeakers: 1 }) }
  assert.deepEqual(routeMessage(room, { mentions: ['x', 'b'] }), ['b'])
  assert.deepEqual(routeMessage(room, { mentions: [] }), [])
})

test('auto routing scores bot profiles before falling back', () => {
  const bots = {
    a: { name: 'alice', role: '情报研究员', persona: '收集事实与来源' },
    b: { name: 'bob', role: '内容写手', persona: '写稿' },
    c: { name: 'carol', role: '审校', persona: '审校稿件' },
  }
  const room = { members: ['a', 'b', 'c'], chiefId: 'a', policy: normalizePolicy({ replyMode: 'auto', maxSpeakers: 1 }) }
  assert.deepEqual(routeMessage(room, { text: '请审校这份稿件', mentions: [] }, bots), ['c'])
  assert.deepEqual(routeMessage(room, { text: '随便聊聊', mentions: [] }, bots), ['a'])
})

test('history and state persist across a reload', async () => {
  const { dir, store, room, bots } = await freshRoom({ replyMode: 'auto' })
  try {
    await store.postMessage({
      roomId: room.id,
      sender: { type: 'human', name: 'human' },
      text: 'hello team',
    })
    await store.postMessage({
      roomId: room.id,
      sender: { type: 'bot', id: bots[0].id, name: bots[0].name },
      text: 'on it',
    })
    const reopened = new TeamStore(dir)
    await reopened.init()
    assert.equal(reopened.listBots().length, 3)
    assert.equal(reopened.listRooms().length, 1)
    const history = await reopened.history(room.id, 10)
    assert.equal(history.length, 2)
    assert.equal(history[0].text, 'hello team')
    assert.equal(history[1].sender.type, 'bot')
    assert.equal(history[1].sender.id, bots[0].id)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('empty message text is rejected', async () => {
  const { store, dir, room } = await freshRoom()
  try {
    await assert.rejects(
      () => store.postMessage({ roomId: room.id, sender: { type: 'human', name: 'human' }, text: '   ' }),
      /text is required/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
