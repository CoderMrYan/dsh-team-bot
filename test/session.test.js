import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BotRuntime } from '../src/host/runtime.js'
import { TeamStore } from '../src/host/store.js'

/** @returns {{runtime: BotRuntime, calls: object[]}} a runtime over a recording fake Session controller. */
function fakeRuntime(options = {}) {
  const calls = []
  let created = 0
  const ctx = {
    sessionController: {
      async create(input) {
        created += 1
        calls.push({ kind: 'create', input, sessionId: `session-${created}` })
        return { sessionId: `session-${created}` }
      },
      async resolveAgent() {
        return { agent: {} }
      },
      async selectModel(input) {
        calls.push({ kind: 'selectModel', input })
      },
    },
  }
  const store = { save: async () => undefined }
  return { runtime: new BotRuntime(ctx, store, options), calls }
}

test('task turns get one Session per task, reused only by the same task', async () => {
  const { runtime, calls } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'reviewer', model: '' }

  const first = await runtime.ensureSession(bot, undefined, { taskSession: true, taskId: 'task-a' })
  const again = await runtime.ensureSession(bot, undefined, { taskSession: true, taskId: 'task-a' })
  const second = await runtime.ensureSession(bot, undefined, { taskSession: true, taskId: 'task-b' })

  assert.equal(first, 'session-1')
  assert.equal(again, 'session-1')
  assert.equal(second, 'session-2')
  assert.equal(bot.taskSessions['task-a'], 'session-1')
  assert.equal(bot.taskSessions['task-b'], 'session-2')
  assert.deepEqual(calls.map((call) => call.kind), ['create', 'create'])
})

test('room turns keep their own long-lived Session apart from task Sessions', async () => {
  const { runtime } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'reviewer', model: '' }

  const room = await runtime.ensureSession(bot, undefined)
  const task = await runtime.ensureSession(bot, undefined, { taskSession: true, taskId: 'task-a' })
  const roomAgain = await runtime.ensureSession(bot, undefined)

  assert.equal(room, 'session-1')
  assert.equal(task, 'session-2')
  assert.equal(roomAgain, 'session-1')
  assert.equal(bot.sessionId, 'session-1')
  assert.equal(bot.taskSessions['task-a'], 'session-2')
})

test('task Session history is capped at 30 tasks per bot', async () => {
  const { runtime } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'reviewer', model: '' }
  for (let index = 0; index < 32; index += 1) {
    await runtime.ensureSession(bot, undefined, { taskSession: true, taskId: `task-${index}` })
  }
  assert.equal(Object.keys(bot.taskSessions).length, 30)
  assert.equal(bot.taskSessions['task-0'], undefined)
  assert.equal(bot.taskSessions['task-31'] !== undefined, true)
})

test('sub-bot and Main Bot budgets are configured separately', () => {
  const { runtime } = fakeRuntime()
  assert.equal(runtime.timeoutFor({ isMain: false }), 900_000)
  assert.equal(runtime.timeoutFor({ isMain: true }), 1_800_000)
  assert.equal(runtime.timeoutFor({}), 900_000)
  assert.equal(runtime.maxTimeoutMs, 1_800_000)
  assert.equal(fakeRuntime({ timeoutMs: 600_000, mainTimeoutMs: 3_600_000 }).runtime.timeoutFor({ isMain: true }), 3_600_000)
  assert.equal(fakeRuntime({ timeoutMs: 600_000, mainTimeoutMs: 3_600_000 }).runtime.maxTimeoutMs, 3_600_000)
})

test('resetBotSessions forgets room and task Sessions but keeps the profile', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-session-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const bot = await store.createBot({ name: 'reviewer', role: 'review', model: 'aliyun-token-plan/glm-5.3' })
    bot.sessionId = 'session-room'
    bot.taskSessions = { 'task-a': 'session-a', 'task-b': 'session-b' }
    bot.taskSessionOrder = ['task-a', 'task-b']
    await store.save()

    const result = await store.resetBotSessions(bot.id)

    assert.equal(result.cleared, 3)
    const after = store.getBot(bot.id)
    assert.equal(after.sessionId, '')
    assert.deepEqual(after.taskSessions, {})
    assert.deepEqual(after.taskSessionOrder, [])
    assert.equal(after.model, 'aliyun-token-plan/glm-5.3')
    assert.equal(after.name, 'reviewer')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

/** @returns {object} a store with the observability calls a turn makes. */
function fakeStore() {
  return {
    save: async () => undefined,
    setPresence: async () => undefined,
    recordActivity: async () => undefined,
    finishActivity: async () => undefined,
  }
}

test('a delegation tool pauses the parent budget until its child returns', async () => {
  const started = Date.now()
  const events = []
  const ctx = {
    sessionController: {
      async create() {
        return { sessionId: 'session-1' }
      },
      async resolveAgent() {
        return { agent: {} }
      },
      async selectModel() {},
      async prompt() {},
      async cancel() {},
      async inspect() {
        const elapsed = Date.now() - started
        if (elapsed >= 30 && events.length === 0) {
          events.push({ seq: 1, type: 'tool/call', data: { name: 'team_task_assign', arguments: '{}', callId: 'call-1' } })
        }
        if (elapsed >= 400) {
          if (events.length === 1) {
            events.push({ seq: 2, type: 'tool/result', data: { message: { toolCallId: 'call-1', content: [{ type: 'text', text: 'reviewed' }] } } })
          }
          if (events.length === 2) {
            events.push({ seq: 3, type: 'turn/end', data: { reason: { kind: 'completed' } } })
          }
        }
        return { events }
      },
    },
  }
  const runtime = new BotRuntime(ctx, fakeStore(), { timeoutMs: 150, pollMs: 10 })
  const text = await runtime.runTurn({ id: 'bot-1', name: 'reviewer', isMain: false, model: '' }, 'review three repos')
  assert.equal(text, '')
  assert.equal(Date.now() - started >= 400, true)
})

test('a turn without progress still times out at its own budget', async () => {
  const ctx = {
    sessionController: {
      async create() {
        return { sessionId: 'session-1' }
      },
      async resolveAgent() {
        return { agent: {} }
      },
      async selectModel() {},
      async prompt() {},
      async cancel() {},
      async inspect() {
        return { events: [] }
      },
    },
  }
  const runtime = new BotRuntime(ctx, fakeStore(), { timeoutMs: 120, pollMs: 10 })
  await assert.rejects(
    runtime.runTurn({ id: 'bot-1', name: 'reviewer', isMain: false, model: '' }, 'wait forever'),
    /timed out after 120ms/,
  )
})
