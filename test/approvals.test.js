import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { approvalGate, executeApproval } from '../src/host/approvals.js'

test('destructive actions require a pending approval and execute exactly once', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-approval-'))
  const store = new TeamStore(dir)
  try {
    const bot = await store.createBot({ name: 'temporary', role: 'test' })
    const gate = await approvalGate(store, {
      kind: 'bot.delete',
      payload: { botId: bot.id },
      summary: `删除子 Bot「${bot.name}」`,
    })
    assert.equal(gate.approved, false)
    assert.equal(gate.pending.status, 'pending')
    assert.equal(store.listBots().some((item) => item.id === bot.id), true)
    await store.resolveApproval(gate.pending.id, 'approved')
    const result = await executeApproval(store, gate.pending.id)
    assert.equal(result.executed, true)
    assert.equal(store.listBots().some((item) => item.id === bot.id), false)
    assert.equal(store.getApproval(gate.pending.id).status, 'executed')
    const second = await executeApproval(store, gate.pending.id)
    assert.equal(second.executed, true)
    assert.equal(store.listBots().some((item) => item.id === bot.id), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a rejected approval cannot be consumed', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-approval-'))
  const store = new TeamStore(dir)
  try {
    const approval = await store.createApproval({
      kind: 'room.delete',
      payload: { roomId: 'room-x' },
      summary: '删除房间',
    })
    await store.resolveApproval(approval.id, 'rejected')
    await assert.rejects(
      () => store.consumeApproval(approval.id, 'room.delete', { roomId: 'room-x' }),
      /not approved/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
