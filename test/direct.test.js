import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { askDirect, askRoom } from '../src/host/actions.js'
import { buildDirectPrompt } from '../src/host/runtime.js'

/** @returns {Promise<{store: TeamStore, dir: string, bot: object}>} an isolated store with one bot. */
async function fresh() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-dm-'))
  const store = new TeamStore(dir)
  await store.init()
  const bot = await store.createBot({ name: 'alice', role: 'researcher', persona: '只写有来源的事实。' })
  return { store, dir, bot }
}

test('direct messages persist and list with their bot', async () => {
  const { store, dir, bot } = await fresh()
  try {
    await store.postDirect({ botId: bot.id, sender: { type: 'human', name: 'human' }, text: '在吗' })
    await store.postDirect({ botId: bot.id, sender: { type: 'bot', id: bot.id, name: bot.name }, text: '在' })
    const history = await store.directHistory(bot.id, 10)
    assert.deepEqual(history.map((item) => item.text), ['在吗', '在'])
    const directs = store.listDirects()
    assert.equal(directs.length, 1)
    assert.equal(directs[0].count, 2)
    assert.equal(directs[0].bot.name, 'alice')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('askDirect runs one fake Session turn and stores its reply', async () => {
  const { store, dir, bot } = await fresh()
  try {
    let seenPrompt = ''
    const runtime = {
      async ask(_bot, prompt) {
        seenPrompt = prompt
        return '收到，我在。'
      },
    }
    const result = await askDirect(store, runtime, { botId: bot.id, text: '在吗' }, undefined)
    assert.equal(result.reply.text, '收到，我在。')
    assert.match(seenPrompt, /private DSH chat/)
    assert.match(seenPrompt, /只写有来源的事实/)
    const history = await store.directHistory(bot.id, 10)
    assert.equal(history.length, 2)
    assert.equal(history[1].sender.type, 'bot')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('buildDirectPrompt carries a chief role note', () => {
  const prompt = buildDirectPrompt(
    { name: 'alice', role: 'researcher', persona: '只写有来源的事实。' },
    [],
    undefined,
    '你是房间「demo」的总管（chief）。',
  )
  assert.match(prompt, /总管（chief）/)
})

test('buildDirectPrompt carries persona and private memory', () => {
  const prompt = buildDirectPrompt(
    { name: 'alice', role: 'researcher', persona: '只写有来源的事实。' },
    [{ sender: { type: 'human', name: 'human' }, text: '周报什么时候发' }],
    {
      botMemory: {
        summary: '团队周报周一发',
        atoms: [{ key: 'weekly', text: '周报周一上午发', importance: 0.9, review: 'accepted' }],
        persona: [{ text: '回答简洁' }],
      },
      query: '周报什么时候发',
    },
  )
  assert.match(prompt, /private DSH chat/)
  assert.match(prompt, /Your private summary/)
  assert.match(prompt, /周报周一上午发/)
  assert.match(prompt, /回答简洁/)
})

test('askRoom refreshes the team summary across team rooms', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-team-summary-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const bot = await store.createBot({ name: 'alice', teamId: 'team-s' })
    const first = await store.createRoom({ name: 'main', members: [bot.id], teamId: 'team-s', teamName: '团队S' })
    await store.createRoom({ name: 'sub', members: [bot.id], teamId: 'team-s', teamName: '团队S' })
    const runtime = { async ask() { return '团队回复内容' } }
    await askRoom(store, runtime, { roomId: first.id, text: '确认团队规范', mentions: [bot.id] })
    const team = await store.teamMemory('team-s')
    assert.match(team.summary, /团队回复内容/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
