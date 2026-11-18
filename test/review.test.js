import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { BotRuntime, reviewerToolAllowlist } from '../src/host/runtime.js'
import { assignTask } from '../src/host/actions.js'

async function fresh() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-review-'))
  const store = new TeamStore(dir)
  await store.init()
  const runtime = new BotRuntime({}, store, { workspaceRoot: path.join(dir, 'workspace'), pollMs: 10 })
  return { dir, store, runtime }
}

async function makeTask(store, runtime, { needsApproval = false } = {}) {
  const owner = await store.createBot({ name: 'writer', role: 'writing' })
  const reviewer = await store.createBot({ name: 'reviewer', role: 'review' })
  const task = await store.createTask({
    title: 'write a report',
    acceptanceCriteria: 'The report exists and contains sources.',
    ownerBotId: owner.id,
    reviewerBotId: reviewer.id,
    needsApproval,
  })
  await store.updateTask(task.id, { status: 'running' })
  const workspace = await runtime.ensureTaskWorkspace(task.id)
  await writeFile(path.join(workspace, 'report.md'), '# report\n', 'utf8')
  await store.addTaskArtifact(task.id, {
    path: path.join(workspace, 'report.md'),
    relative: 'report.md',
    name: 'report.md',
  })
  return { owner, reviewer, task, workspace }
}

test('task requires independent review before done', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const { owner, reviewer, task } = await makeTask(store, runtime)
    await assert.rejects(
      () => store.updateTask(task.id, { status: 'done' }),
      /before independent review/,
    )
    await assert.rejects(
      () => store.reviewTask(task.id, { reviewerBotId: owner.id, verdict: 'approve' }),
      /owner cannot review/,
    )
    const submitted = await store.submitTaskReview(task.id, { actorBotId: owner.id, summary: 'ready' })
    assert.equal(submitted.status, 'in_review')
    assert.equal(submitted.reviewStatus, 'pending')
    const approved = await store.reviewTask(task.id, {
      reviewerBotId: reviewer.id,
      verdict: 'approve',
      notes: 'sources checked',
    })
    assert.equal(approved.status, 'done')
    assert.equal(approved.reviewStatus, 'approved')
    assert.equal(approved.progress, 100)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('changes increment attempts and three failures block the task', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const { owner, reviewer, task } = await makeTask(store, runtime)
    for (let round = 1; round <= 3; round += 1) {
      await store.submitTaskReview(task.id, { actorBotId: owner.id, summary: `attempt ${round}` })
      const result = await store.reviewTask(task.id, {
        reviewerBotId: reviewer.id,
        verdict: 'changes',
        notes: `fix ${round}`,
      })
      assert.equal(result.reviewAttempts, round)
      assert.equal(result.status, round === 3 ? 'blocked' : 'running')
      if (round < 3) await store.updateTask(task.id, { status: 'running' })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('reviewed task can require human approval before done', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const { owner, reviewer, task } = await makeTask(store, runtime, { needsApproval: true })
    await store.submitTaskReview(task.id, { actorBotId: owner.id, summary: 'ready to publish' })
    const reviewed = await store.reviewTask(task.id, {
      reviewerBotId: reviewer.id,
      verdict: 'approve',
      notes: 'review passed',
    })
    assert.equal(reviewed.status, 'needs_approval')
    assert.equal(reviewed.reviewStatus, 'approved')
    await assert.rejects(() => store.updateTask(task.id, { status: 'done' }), /before independent review/)
    const approved = await store.approveTask(task.id, { actor: 'human', notes: 'publish ok' })
    assert.equal(approved.status, 'done')
    assert.equal(approved.approvalStatus, 'approved')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('task workspace isolates artifacts and is passed to the task Session', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const bot = await store.createBot({ name: 'worker', role: 'work' })
    const task = await store.createTask({ title: 'isolated' })
    const workspace = await runtime.ensureTaskWorkspace(task.id)
    assert.equal(path.basename(path.dirname(workspace)), 'tasks')
    await writeFile(path.join(workspace, 'out.txt'), 'ok', 'utf8')
    const accepted = await runtime.resolveTaskArtifact(task.id, 'out.txt')
    assert.equal(accepted.relative, 'out.txt')
    await assert.rejects(
      () => runtime.resolveTaskArtifact(task.id, '../escape.txt'),
      /inside the task workspace/,
    )
    const calls = []
    const stub = {
      ensureTaskWorkspace: runtime.ensureTaskWorkspace.bind(runtime),
      async ask(_bot, prompt, _signal, context) {
        calls.push({ prompt, context })
        return 'done'
      },
    }
    await assignTask(store, stub, { taskId: task.id, botId: bot.id })
    assert.equal(calls.length, 1)
    assert.match(calls[0].prompt, /report\.md|acceptance criteria/i)
    assert.equal(calls[0].context.workspace, workspace)
    assert.equal(store.getTask(task.id).workspace, workspace)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a task submitted during the owner turn stays in_review', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const owner = await store.createBot({ name: 'owner', role: 'work' })
    const reviewer = await store.createBot({ name: 'reviewer', role: 'review' })
    const task = await store.createTask({ title: 'submit in turn', ownerBotId: owner.id, reviewerBotId: reviewer.id })
    const workspace = await runtime.ensureTaskWorkspace(task.id)
    await writeFile(path.join(workspace, 'out.md'), 'done', 'utf8')
    await store.addTaskArtifact(task.id, { path: path.join(workspace, 'out.md'), relative: 'out.md', name: 'out.md' })
    const stub = {
      ensureTaskWorkspace: runtime.ensureTaskWorkspace.bind(runtime),
      async ask() {
        await store.submitTaskReview(task.id, { actorBotId: owner.id, summary: 'ready' })
        return 'submitted'
      },
    }
    await assignTask(store, stub, { taskId: task.id, botId: owner.id })
    assert.equal(store.getTask(task.id).status, 'in_review')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('assistant usage is accumulated on the task', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const bot = await store.createBot({ name: 'usage', role: 'work' })
    const task = await store.createTask({ title: 'token task', ownerBotId: bot.id })
    await runtime.handleEvent(bot, {
      seq: 1,
      type: 'assistant/message',
      data: {
        message: { content: [] },
        usage: { inputTokens: 120, outputTokens: 30, totalTokens: 150 },
      },
    }, { taskId: task.id })
    assert.equal(store.getTask(task.id).usage.totalTokens, 150)
    assert.equal(store.getTask(task.id).usage.calls, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('reviewer allowlist keeps read and review tools, removes writers', () => {
  const names = ['read', 'glob', 'grep', 'web_search', 'web_fetch', 'write', 'edit', 'pwsh', 'team_task_get', 'team_task_review', 'team_task_artifact', 'team_memory_remember', 'team_task_cancel']
  const allow = reviewerToolAllowlist(names)
  assert.deepEqual(allow, ['read', 'glob', 'grep', 'web_search', 'web_fetch', 'team_task_get', 'team_task_review'])
  assert.equal(allow.includes('write'), false)
  assert.equal(allow.includes('edit'), false)
  assert.equal(allow.includes('pwsh'), false)
  assert.equal(allow.includes('team_task_artifact'), false)
})

test('reviewer turn applies and removes the read-only tool restriction', async () => {
  const { store, dir } = await fresh()
  try {
    const bot = await store.createBot({ name: 'reviewer-run', role: 'review' })
    const task = await store.createTask({ title: 'review run', ownerBotId: bot.id })
    let prompted = false
    let allowed
    let disposed = false
    const ctx = {
      sessionController: {
        async create() { return { sessionId: 'session-reviewer' } },
        async resolveAgent() {
          return {
            agent: {
              ctx: {
                tools: {
                  restrict(filter) {
                    allowed = filter
                    return () => { disposed = true }
                  },
                },
              },
            },
          }
        },
        async inspect() {
          return prompted
            ? { events: [{ seq: 1, type: 'turn/end', data: { reason: { kind: 'completed' } } }] }
            : { events: [] }
        },
        async prompt() { prompted = true },
        async selectModel() {},
        cancel() {},
      },
      tools: {
        schemas: () => [
          { name: 'read' },
          { name: 'write' },
          { name: 'edit' },
          { name: 'team_task_get' },
          { name: 'team_task_review' },
        ],
      },
    }
    const runtime = new BotRuntime(ctx, store, { workspaceRoot: path.join(dir, 'workspace'), pollMs: 1 })
    await runtime.runTurn(bot, 'review this', undefined, {
      taskId: task.id,
      taskSession: true,
      workspace: await runtime.ensureTaskWorkspace(task.id),
      readOnly: true,
    })
    assert.ok(allowed)
    assert.equal(allowed.allow.includes('read'), true)
    assert.equal(allowed.allow.includes('team_task_review'), true)
    assert.equal(allowed.allow.includes('write'), false)
    assert.equal(allowed.allow.includes('edit'), false)
    assert.equal(disposed, true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('artifact paths cannot escape the task workspace', async () => {
  const { store, runtime, dir } = await fresh()
  try {
    const task = await store.createTask({ title: 'escape' })
    await assert.rejects(
      () => runtime.resolveTaskArtifact(task.id, '../../outside.txt'),
      /inside the task workspace/,
    )
    const resolved = await runtime.resolveTaskArtifact(task.id, 'notes/inside.txt')
    assert.equal(resolved.relative, path.join('notes', 'inside.txt'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
