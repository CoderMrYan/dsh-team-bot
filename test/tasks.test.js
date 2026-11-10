import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { BotRuntime } from '../src/host/runtime.js'
import { handoffTask } from '../src/host/actions.js'

async function fresh() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-tasks-'))
  const store = new TeamStore(dir)
  await store.init()
  return { store, dir }
}

test('main bot is unique and stable', async () => {
  const { store, dir } = await fresh()
  try {
    const first = await store.ensureMainBot({ persona: 'orchestrate' })
    const second = await store.ensureMainBot()
    assert.equal(first.id, second.id)
    assert.equal(first.isMain, true)
    assert.equal(second.isMain, true)
    const other = await store.createBot({ name: 'worker', role: 'research', isMain: true })
    assert.equal(store.getBot(first.id).isMain, false)
    assert.equal(other.isMain, true)
    assert.equal(store.getMainBot().id, other.id)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('tasks carry owner, steps, progress, artifacts and activity', async () => {
  const { store, dir } = await fresh()
  try {
    const bot = await store.createBot({ name: 'researcher', role: 'research' })
    const task = await store.createTask({ title: '研究', brief: '找资料', ownerBotId: bot.id })
    assert.equal(task.status, 'queued')
    assert.equal(task.ownerBotId, bot.id)
    await store.updateTask(task.id, { status: 'running', progress: 20 })
    const step = await store.addTaskStep(task.id, {
      kind: 'tool',
      label: '调用 web_search',
      callId: 'call-1',
      status: 'running',
    })
    assert.equal(step.callId, 'call-1')
    await store.recordActivity({
      botId: bot.id,
      taskId: task.id,
      kind: 'tool',
      label: '调用 web_search',
      callId: 'call-1',
      status: 'running',
    })
    await store.finishTaskStep(task.id, 'call-1', { status: 'done' })
    const runStep = await store.addTaskStep(task.id, {
      kind: 'run',
      label: '开始执行',
      status: 'running',
    })
    await store.finishOpenTaskSteps(task.id, 'done', '本轮执行结束', 'run')
    await store.addTaskArtifact(task.id, { name: 'notes.md', path: 'notes.md' })
    const latest = store.getTask(task.id)
    assert.equal(latest.steps.find((item) => item.callId === 'call-1').status, 'done')
    assert.equal(latest.steps.find((item) => item.id === runStep.id).status, 'done')
    assert.equal(latest.artifacts[0].name, 'notes.md')
    assert.equal(store.listActivity({ taskId: task.id }).length, 1)
    assert.equal(store.listTasks({ ownerBotId: bot.id }).length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('runtime records tool activity and closes the task on turn end', async () => {
  const { store, dir } = await fresh()
  try {
    const bot = await store.createBot({ name: 'researcher', role: 'research' })
    const task = await store.createTask({ title: '查资料', ownerBotId: bot.id })
    const runtime = new BotRuntime({}, store, { pollMs: 10 })
    await runtime.handleEvent(bot, {
      seq: 1,
      type: 'tool/call',
      data: { name: 'web_search', arguments: '{"query":"x"}', callId: 'call-9' },
    }, { taskId: task.id })
    let latest = store.getTask(task.id)
    assert.equal(latest.steps.at(-1).callId, 'call-9')
    assert.equal(latest.steps.at(-1).status, 'running')
    assert.equal(store.listPresence().find((row) => row.botId === bot.id).status, 'tool')
    await runtime.handleEvent(bot, {
      seq: 2,
      type: 'tool/result',
      data: { message: { toolCallId: 'call-9', isError: false } },
    }, { taskId: task.id })
    latest = store.getTask(task.id)
    assert.equal(latest.steps.find((item) => item.callId === 'call-9').status, 'done')
    assert.equal(store.listActivity({ taskId: task.id }).find((item) => item.callId === 'call-9').status, 'done')
    await runtime.handleEvent(bot, {
      seq: 3,
      type: 'turn/end',
      data: { reason: { kind: 'completed' } },
    }, { taskId: task.id })
    latest = store.getTask(task.id)
    assert.equal(latest.status, 'waiting')
    assert.equal(store.listPresence().find((row) => row.botId === bot.id).status, 'idle')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('handoff transfers ownership and wakes the target bot asynchronously', async () => {
  const { store, dir } = await fresh()
  try {
    const from = await store.createBot({ name: 'researcher', role: 'research' })
    const to = await store.createBot({ name: 'writer', role: 'writing' })
    const task = await store.createTask({ title: '接力', ownerBotId: from.id })
    const runtime = {
      asks: [],
      async ask(bot, prompt, signal, context) {
        this.asks.push({ botId: bot.id, prompt, context })
        return '目标 Bot 已接手'
      },
    }
    const handoff = handoffTask
    assert.ok(handoff)
    const result = await handoff(store, runtime, { taskId: task.id, fromBotId: from.id, toBotId: to.id, note: '请你继续写' })
    assert.equal(result.queued, true)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const latest = store.getTask(task.id)
    assert.equal(latest.ownerBotId, to.id)
    assert.equal(latest.steps.some((step) => step.kind === 'handoff' && step.label.includes('writer')), true)
    assert.equal(runtime.asks[0].botId, to.id)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
