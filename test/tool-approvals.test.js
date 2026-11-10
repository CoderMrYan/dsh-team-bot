import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { installToolApprovalBridge } from '../src/host/tool-approvals.js'

test('tool approval requests are surfaced and resolved from the command center', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-tool-approval-'))
  const store = new TeamStore(dir)
  try {
    await store.init()
    const bot = await store.createBot({ name: 'researcher', role: 'research' })
    bot.sessionId = 'session-owned'
    await store.save()
    let handler
    let nextCalls = 0
    const ctx = {
      on: (event, fn) => {
        assert.equal(event, 'approval/request')
        handler = fn
        return () => undefined
      },
    }
    const bridge = installToolApprovalBridge(ctx, store)
    const promise = handler({
      agent: { id: 'session-owned' },
      toolName: 'pwsh',
      callId: 'call-1',
      reason: 'workspace write',
    }, async () => { nextCalls += 1; return 'unavailable' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    const pending = store.listApprovals({ status: 'pending' })
    assert.equal(pending.length, 1)
    assert.equal(pending[0].kind, 'tool.approval')
    assert.match(pending[0].summary, /researcher/)
    assert.equal(await bridge.resolve(pending[0].id, 'allowed-once'), true)
    assert.equal(await promise, 'allowed-once')
    assert.equal(nextCalls, 0)
    assert.equal(store.getApproval(pending[0].id).status, 'approved')

    const external = handler({
      agent: { id: 'some-other-session' },
      toolName: 'pwsh',
    }, async () => { nextCalls += 1; return 'unavailable' })
    assert.equal(await external, 'unavailable')
    assert.equal(nextCalls, 1)
    bridge.dispose()
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
