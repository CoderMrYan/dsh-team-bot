import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRoomPrompt, textOf } from '../src/host/runtime.js'

test('textOf keeps only text blocks and trims', () => {
  const content = [
    { type: 'reasoning', text: 'hidden' },
    { type: 'text', text: ' hello ' },
    { type: 'text', text: 'world' },
    { type: 'tool-call', id: 'c1', name: 'x', arguments: '{}' },
  ]
  assert.equal(textOf(content), 'hello \nworld')
  assert.equal(textOf(undefined), '')
})

test('buildRoomPrompt injects recalled memory', () => {
  const prompt = buildRoomPrompt(
    { name: 'demo', policy: {} },
    { name: 'researcher', role: '情报', persona: '只写有来源的事实。' },
    [{ sender: { type: 'human', name: 'human' }, text: '周报什么时候发' }],
    {
      roomMemory: { summary: '本周在做周报模板', atoms: [{ key: 'weekly', text: '周报周一上午发', importance: 0.9, review: 'accepted' }] },
      botMemory: { atoms: [], persona: [] },
      query: '周报什么时候发',
    },
  )
  assert.match(prompt, /Shared room summary/)
  assert.match(prompt, /周报周一上午发/)
})

test('buildRoomPrompt carries persona, room, recent senders and [PASS] rule', () => {
  const room = { name: 'demo', policy: {} }
  const bot = { name: 'researcher', role: '情报研究员', persona: '只写有来源的事实。' }
  const messages = [
    { sender: { type: 'human', name: 'human' }, text: '开始吧' },
    { sender: { type: 'bot', name: 'writer' }, text: '收到' },
  ]
  const prompt = buildRoomPrompt(room, bot, messages)
  assert.match(prompt, /researcher/)
  assert.match(prompt, /情报研究员/)
  assert.match(prompt, /只写有来源的事实/)
  assert.match(prompt, /\[human\] 开始吧/)
  assert.match(prompt, /\[writer\] 收到/)
  assert.match(prompt, /\[PASS\]/)
})
