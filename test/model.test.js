import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BotRuntime, parseModelRef } from '../src/host/runtime.js'
import { TeamStore, normalizeBotModel } from '../src/host/store.js'

/** @returns {{runtime: BotRuntime, calls: object[]}} a runtime over a recording fake Session controller. */
function fakeRuntime() {
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
        if (input.model === 'kaboom') throw new Error('NO_ADAPTER: unknown provider')
      },
    },
  }
  const store = { save: async () => undefined }
  return { runtime: new BotRuntime(ctx, store), calls }
}

test('parseModelRef splits only on the first slash', () => {
  assert.deepEqual(parseModelRef('openai/gpt-6.1-sol'), { provider: 'openai', model: 'gpt-6.1-sol' })
  assert.deepEqual(parseModelRef('relay/meta-llama/llama-3'), { provider: 'relay', model: 'meta-llama/llama-3' })
  assert.deepEqual(parseModelRef('  qwen/qwen3-max  '), { provider: 'qwen', model: 'qwen3-max' })
  assert.equal(parseModelRef(''), undefined)
  assert.equal(parseModelRef(undefined), undefined)
  assert.throws(() => parseModelRef('gpt-6.1-sol'), /provider\/model/)
  assert.throws(() => parseModelRef('/gpt-6.1-sol'), /provider\/model/)
  assert.throws(() => parseModelRef('openai/'), /provider\/model/)
})

test('normalizeBotModel accepts an empty setting or a provider/model route', () => {
  assert.equal(normalizeBotModel(''), '')
  assert.equal(normalizeBotModel(' openai/gpt-6.1-sol '), 'openai/gpt-6.1-sol')
  assert.throws(() => normalizeBotModel('gpt-6.1-sol'), /provider\/model/)
})

test('applyModel binds the profile model once per Session', async () => {
  const { runtime, calls } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'dev', model: 'openai/gpt-6.1-sol' }

  await runtime.applyModel(bot, 'session-a')
  await runtime.applyModel(bot, 'session-a')

  const selections = calls.filter((call) => call.kind === 'selectModel')
  assert.equal(selections.length, 1)
  assert.deepEqual(selections[0].input, {
    sessionId: 'session-a',
    provider: 'openai',
    model: 'gpt-6.1-sol',
  })
})

test('applyModel re-applies after the profile model changes', async () => {
  const { runtime, calls } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'dev', model: 'openai/gpt-6.1-sol' }

  await runtime.applyModel(bot, 'session-a')
  bot.model = 'qwen/qwen3-max'
  await runtime.applyModel(bot, 'session-a')

  const selections = calls.filter((call) => call.kind === 'selectModel')
  assert.equal(selections.length, 2)
  assert.equal(selections[1].input.provider, 'qwen')
  assert.equal(selections[1].input.model, 'qwen3-max')
})

test('applyModel leaves the default model alone when the profile setting is empty', async () => {
  const { runtime, calls } = fakeRuntime()
  await runtime.applyModel({ id: 'bot-1', name: 'dev', model: '' }, 'session-a')
  assert.equal(calls.filter((call) => call.kind === 'selectModel').length, 0)
})

test('applyModel reports the provider failure instead of silently falling back', async () => {
  const { runtime } = fakeRuntime()
  await assert.rejects(
    runtime.applyModel({ id: 'bot-1', name: 'dev', model: 'nope/kaboom' }, 'session-a'),
    /cannot use model "nope\/kaboom"/,
  )
})

test('ensureSession creates a Session and applies the configured model', async () => {
  const { runtime, calls } = fakeRuntime()
  const bot = { id: 'bot-1', name: 'dev', model: 'relay/gpt-6.1-sol', workspace: '' }

  const sessionId = await runtime.ensureSession(bot)
  assert.equal(sessionId, 'session-1')
  assert.equal(bot.sessionId, 'session-1')
  assert.deepEqual(calls.map((call) => call.kind), ['create', 'selectModel'])
})

test('store keeps the model through create and update', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-model-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const bot = await store.createBot({ name: 'dev', role: 'coder', model: 'openai/gpt-6.1-sol' })
    assert.equal(bot.model, 'openai/gpt-6.1-sol')

    await store.updateBot(bot.id, { model: 'qwen/qwen3-max' })
    assert.equal(store.getBot(bot.id).model, 'qwen/qwen3-max')

    await assert.rejects(store.updateBot(bot.id, { model: 'no-provider' }), /provider\/model/)
    await store.updateBot(bot.id, { model: '' })
    assert.equal(store.getBot(bot.id).model, '')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
