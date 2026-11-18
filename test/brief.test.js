import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { buildTeamBrief } from '../src/host/brief.js'

test('brief summarizes task states, attention and usage', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-brief-'))
  const store = new TeamStore(dir)
  try {
    await store.init()
    const bot = await store.createBot({ name: 'worker', role: 'work', skills: ['write', 'verify'] })
    const done = await store.createTask({ title: 'done task', ownerBotId: bot.id })
    await store.updateTask(done.id, { reviewStatus: 'approved', status: 'done' })
    await store.addTaskUsage(done.id, { inputTokens: 100, outputTokens: 50 })
    await store.incrementTaskWake(done.id)
    const blocked = await store.createTask({ title: 'blocked task', ownerBotId: bot.id })
    await store.updateTask(blocked.id, { status: 'blocked', currentStep: 'waiting for input' })
    const queued = await store.createTask({ title: 'queued task', ownerBotId: bot.id })
    await store.updateTask(queued.id, { status: 'queued' })

    const brief = await buildTeamBrief(store)
    assert.equal(brief.counts.done, 1)
    assert.equal(brief.counts.blocked, 1)
    assert.equal(brief.counts.queued, 1)
    assert.equal(brief.totals.tokens, 150)
    assert.equal(brief.totals.wakes, 1)
    assert.equal(brief.attention.length, 1)
    assert.match(brief.text, /blocked=1/)
    assert.equal(brief.byBot[0].botId, bot.id)
    assert.equal(brief.byBot[0].tokens, 150)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('high-risk task kinds force approval under a human policy', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-approval-kind-'))
  const store = new TeamStore(dir)
  try {
    await store.init()
    const lead = await store.createBot({ name: 'lead', role: 'lead' })
    const reviewer = await store.createBot({ name: 'reviewer', role: 'review' })
    await store.createRoom({
      name: 'team room',
      members: [lead.id, reviewer.id],
      chiefId: lead.id,
      teamId: 'team-risk',
      teamName: 'Risk Team',
    })
    await store.upsertTeamCard('team-risk', {
      name: 'Risk Team',
      leadBotId: lead.id,
      reviewerBotId: reviewer.id,
      approvalPolicy: { publish: 'human', merge: 'human', spend: 'human', external: 'human' },
    })
    const publish = await store.createTask({ title: 'publish video', kind: 'publish', teamId: 'team-risk', ownerBotId: lead.id })
    assert.equal(publish.needsApproval, true)
    assert.equal(publish.kind, 'publish')
    assert.equal(publish.status, 'needs_approval')
    assert.equal(publish.approvalStage, 'pre')
    await assert.rejects(() => store.updateTask(publish.id, { status: 'running' }), /human approval/)
    const approved = await store.approveTask(publish.id, { actor: 'human' })
    assert.equal(approved.status, 'queued')
    assert.equal(approved.approvalStatus, 'approved')
    const implementation = await store.createTask({ title: 'write script', kind: 'implementation', teamId: 'team-risk', ownerBotId: lead.id })
    assert.equal(implementation.needsApproval, false)
    await store.upsertTeamCard('team-risk', { approvalPolicy: { publish: 'auto' } })
    const autoPublish = await store.createTask({ title: 'auto publish', kind: 'publish', teamId: 'team-risk', ownerBotId: lead.id })
    assert.equal(autoPublish.needsApproval, false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('team card stores lead, reviewer, rules and approval policy', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-card-'))
  const store = new TeamStore(dir)
  try {
    await store.init()
    const lead = await store.createBot({ name: 'lead', role: 'lead' })
    const reviewer = await store.createBot({ name: 'reviewer', role: 'review' })
    const team = await store.createRoom({
      name: 'team room',
      members: [lead.id, reviewer.id],
      chiefId: lead.id,
      teamId: 'team-test',
      teamName: 'Test Team',
    })
    assert.equal(team.teamId, 'team-test')
    const card = await store.upsertTeamCard('team-test', {
      name: 'Test Team',
      leadBotId: lead.id,
      reviewerBotId: reviewer.id,
      rules: 'Never touch production.',
      skills: ['research', 'review'],
      approvalPolicy: { publish: 'human', merge: 'human', spend: 'human', external: 'human' },
    })
    assert.equal(card.leadBotId, lead.id)
    assert.equal(card.reviewerBotId, reviewer.id)
    assert.equal(card.rules, 'Never touch production.')
    assert.deepEqual(card.skills, ['research', 'review'])
    assert.equal(store.getTeamCard('team-test').reviewerBotId, reviewer.id)
    await assert.rejects(
      () => store.upsertTeamCard('team-test', { leadBotId: reviewer.id, reviewerBotId: reviewer.id }),
      /reviewer must be different/,
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
