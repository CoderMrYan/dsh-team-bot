import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  buildSummary,
  captureFromHuman,
  createAtom,
  formatMemory,
  mergeAtoms,
  recallAtoms,
  tokenize,
} from '../src/host/memory.js'
import { TeamStore } from '../src/host/store.js'

test('tokenize covers CJK bigrams and ASCII words', () => {
  const tokens = tokenize('AI 融资 Round-2')
  assert.ok(tokens.includes('ai'))
  assert.ok(tokens.includes('融资'))
  assert.ok(tokens.includes('round'))
})

test('recall ranks the atom matching the query first', () => {
  const funding = createAtom({ text: 'Sand.ai 完成 2 亿美元 A+ 轮融资', key: 'sand' })
  const policy = createAtom({ text: '发改委推进人工智能立法', key: 'law' })
  const recalled = recallAtoms('本周融资进展如何', [policy, funding])
  assert.equal(recalled[0].key, 'sand')
})

test('same key supersedes and a near duplicate is skipped', () => {
  const first = createAtom({ text: '周报每周五下午发', key: 'weekly' })
  const next = createAtom({ text: '周报改为每周一上午发', key: 'weekly' })
  const replaced = mergeAtoms([first], next)
  assert.equal(replaced.replaced, true)
  assert.equal(replaced.atoms.length, 1)
  assert.equal(replaced.atoms[0].text, '周报改为每周一上午发')
  assert.equal(replaced.atoms[0].id, first.id)

  const duplicate = createAtom({ text: '周报改为每周一上午发', key: 'other' })
  const skipped = mergeAtoms(replaced.atoms, duplicate)
  assert.equal(skipped.skipped, true)
  assert.equal(skipped.atoms.length, 1)
})

test('capture only fires on explicit remembering language', () => {
  assert.equal(captureFromHuman('明天上午开会', 'm1'), undefined)
  const accepted = captureFromHuman('记住：以后周报都用中文', 'm2')
  assert.equal(accepted.review, 'accepted')
  assert.match(accepted.text, /周报/)
  const pending = captureFromHuman('以后默认先给结论', 'm3')
  assert.equal(pending.review, 'pending')
})

test('summary keeps the latest messages and formatMemory injects it', () => {
  const messages = [
    { sender: { type: 'human' }, text: '第一句' },
    { sender: { type: 'bot', name: 'writer' }, text: '第二句' },
  ]
  const summary = buildSummary(messages)
  assert.match(summary, /\[human\] 第一句/)
  assert.match(summary, /\[writer\] 第二句/)
  const text = formatMemory(
    { summary: '本周在做 dsh-team-bot', atoms: [createAtom({ text: '周报周一发', key: 'weekly' })] },
    { atoms: [createAtom({ text: '偏好中文', key: 'lang' })], persona: [{ text: '回答简洁' }] },
    '周报用中文什么时候发',
  )
  assert.match(text, /Shared room summary/)
  assert.match(text, /Your private memory/)
  assert.match(text, /回答简洁/)
})

test('pending and rejected atoms are not recalled until accepted', () => {
  const pending = createAtom({ text: '以后默认用英文', key: 'lang', review: 'pending' })
  assert.equal(recallAtoms('英文', [pending]).length, 0)
  const accepted = createAtom({ text: '以后默认用英文', key: 'lang', review: 'accepted' })
  assert.equal(recallAtoms('英文', [accepted]).length, 1)
  assert.equal(recallAtoms('英文', [{ ...accepted, review: 'rejected' }]).length, 0)
})

test('store review changes an atom state and validates it', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-review-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const bot = await store.createBot({ name: 'alice', role: 'researcher' })
    const room = await store.createRoom({ name: 'general', members: [bot.id] })
    const result = await store.rememberRoom(room.id, createAtom({ text: '周报周一发', key: 'weekly' }))
    const atomId = result.memory.atoms[0].id
    const rejected = await store.reviewRoom(room.id, atomId, 'rejected')
    assert.equal(rejected.atoms[0].review, 'rejected')
    await assert.rejects(() => store.reviewRoom(room.id, atomId, 'bogus'), /invalid review state/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('team memory is shared across rooms and injected', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-team-memory-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const alice = await store.createBot({ name: 'alice', teamId: 'team-t1' })
    const bob = await store.createBot({ name: 'bob', teamId: 'team-t1' })
    await store.createRoom({ name: 'one', members: [alice.id], teamId: 'team-t1' })
    await store.createRoom({ name: 'two', members: [bob.id], teamId: 'team-t1' })
    await store.rememberTeam('team-t1', createAtom({ text: '团队统一用中文交付', key: 'lang' }))
    const team = await store.teamMemory('team-t1')
    assert.equal(team.atoms[0].text, '团队统一用中文交付')
    const text = formatMemory(undefined, undefined, '中文', team)
    assert.match(text, /Shared team facts/)
    await store.reviewTeam('team-t1', team.atoms[0].id, 'rejected')
    assert.equal((await store.teamMemory('team-t1')).atoms[0].review, 'rejected')
    await assert.rejects(() => store.teamMemory('team-missing'), /unknown team/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('store persists shared and private memory across a reload', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-memory-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const bot = await store.createBot({ name: 'alice', role: 'researcher' })
    const room = await store.createRoom({ name: 'general', members: [bot.id] })
    await store.rememberRoom(room.id, createAtom({ text: '项目代号 Apollo', key: 'project' }))
    await store.rememberBot(bot.id, createAtom({ text: '偏好中文', key: 'lang' }))
    await store.addPersona(bot.id, { id: 'p1', text: '回答简洁', createdAt: new Date().toISOString() })

    const reopened = new TeamStore(dir)
    await reopened.init()
    const roomMemory = await reopened.roomMemory(room.id)
    assert.equal(roomMemory.atoms[0].text, '项目代号 Apollo')
    const botMemory = await reopened.botMemory(bot.id)
    assert.equal(botMemory.atoms[0].text, '偏好中文')
    assert.equal(botMemory.persona.length, 1)

    await reopened.forgetRoom(room.id, roomMemory.atoms[0].id)
    assert.equal((await reopened.roomMemory(room.id)).atoms.length, 0)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
