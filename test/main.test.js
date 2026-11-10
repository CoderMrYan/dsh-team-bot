import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { askMain, commandState, ensureMain } from '../src/host/main.js'

test('main bot is a real direct-chat agent with command state', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-main-'))
  const store = new TeamStore(dir)
  try {
    const main = await ensureMain(store)
    assert.equal(main.isMain, true)
    const bot = await store.createBot({ name: 'researcher', role: '研究' })
    const task = await store.createTask({ title: '查资料', ownerBotId: bot.id })
    const runtime = {
      asks: [],
      async ask(target, prompt) {
        this.asks.push({ target, prompt })
        return '已收到，开始执行。'
      },
    }
    const result = await askMain(store, runtime, { text: '给 researcher 派任务' })
    assert.equal(result.reply.text, '已收到，开始执行。')
    assert.equal(runtime.asks[0].target.id, main.id)
    assert.match(runtime.asks[0].prompt, /查资料/)
    const state = await commandState(store)
    assert.equal(state.main.id, main.id)
    assert.equal(state.tasks[0].id, task.id)
    const history = await store.directHistory(main.id, 10)
    assert.equal(history[0].sender.type, 'human')
    assert.equal(history.at(-1).text, '已收到，开始执行。')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
