import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { BotRuntime } from '../src/host/runtime.js'
import { buildTeamBrief } from '../src/host/brief.js'
import { askMain } from '../src/host/main.js'

async function fresh() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-project-'))
  const store = new TeamStore(dir)
  await store.init()
  return { dir, store }
}

test('tasks, rooms and project memory are isolated by workspace path', async () => {
  const { dir, store } = await fresh()
  try {
    const bot = await store.createBot({ name: 'worker', role: 'work' })
    const projectA = path.join(dir, 'project-a')
    const projectB = path.join(dir, 'project-b')
    const taskA = await store.createTask({ title: 'A task', ownerBotId: bot.id, projectId: projectA })
    const taskB = await store.createTask({ title: 'B task', ownerBotId: bot.id, projectId: projectB })
    assert.equal(store.listTasks({ projectId: projectA }).length, 1)
    assert.equal(store.listTasks({ projectId: projectA })[0].id, taskA.id)
    assert.equal(store.listTasks({ projectId: projectB })[0].id, taskB.id)

    await store.rememberProject(projectA, { text: 'A uses blue', key: 'color' })
    await store.rememberProject(projectB, { text: 'B uses green', key: 'color' })
    await store.setProjectSummary(projectA, 'Only edit src/ in this project.')
    assert.equal((await store.projectMemory(projectA)).summary, 'Only edit src/ in this project.')
    assert.equal((await store.projectMemory(projectB)).summary, '')
    assert.match((await store.projectMemory(projectA)).atoms[0].text, /blue/)
    assert.match((await store.projectMemory(projectB)).atoms[0].text, /green/)
    assert.equal((await store.projectMemory(projectA)).atoms.length, 1)

    const roomA = await store.createRoom({
      name: 'room-a',
      members: [bot.id],
      projectId: projectA,
    })
    const roomB = await store.createRoom({
      name: 'room-b',
      members: [bot.id],
      projectId: projectB,
    })
    assert.equal(store.listRooms({ projectId: projectA })[0].id, roomA.id)
    assert.equal(store.listRooms({ projectId: projectB })[0].id, roomB.id)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('bot private memory is project scoped while persona stays global', async () => {
  const { dir, store } = await fresh()
  try {
    const bot = await store.createBot({ name: 'worker', role: 'work' })
    const projectA = path.join(dir, 'a')
    const projectB = path.join(dir, 'b')
    await store.rememberBot(bot.id, { text: 'A only', key: 'a' }, projectA)
    await store.rememberBot(bot.id, { text: 'B only', key: 'b' }, projectB)
    await store.addPersona(bot.id, { id: 'p1', text: 'be concise' })
    const memoryA = await store.botMemory(bot.id, projectA)
    const memoryB = await store.botMemory(bot.id, projectB)
    assert.deepEqual(memoryA.atoms.map((atom) => atom.text), ['A only'])
    assert.deepEqual(memoryB.atoms.map((atom) => atom.text), ['B only'])
    assert.deepEqual(memoryA.persona.map((item) => item.text), ['be concise'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('task workspace lives under the project .dsh-team directory', async () => {
  const { dir, store } = await fresh()
  try {
    const bot = await store.createBot({ name: 'worker', role: 'work' })
    const project = path.join(dir, 'project')
    const task = await store.createTask({ title: 'project task', ownerBotId: bot.id, projectId: project })
    const runtime = new BotRuntime({}, store, { workspaceRoot: path.join(dir, 'fallback') })
    const workspace = await runtime.ensureTaskWorkspace(task.id, task.projectId)
    assert.equal(workspace, path.join(project, '.dsh-team', 'tasks', task.id))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('brief only counts the requested project', async () => {
  const { dir, store } = await fresh()
  try {
    const projectA = path.join(dir, 'a')
    const projectB = path.join(dir, 'b')
    const taskA = await store.createTask({ title: 'A task', projectId: projectA })
    const taskB = await store.createTask({ title: 'B task', projectId: projectB })
    const brief = await buildTeamBrief(store, { projectId: projectA })
    assert.equal(brief.totals.tasks, 1)
    assert.equal(brief.groups.length, 1)
    const all = await buildTeamBrief(store)
    assert.equal(all.totals.tasks, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('long-lived bot sessions are keyed by project', async () => {
  const { dir, store } = await fresh()
  try {
    const bot = await store.createBot({ name: 'worker', role: 'work' })
    const projectA = path.join(dir, 'a')
    const projectB = path.join(dir, 'b')
    const runtime = new BotRuntime({}, store, {})
    runtime.rememberSession(bot, 'session-a', { projectId: projectA })
    runtime.rememberSession(bot, 'session-b', { projectId: projectB })
    assert.equal(runtime.storedSession(bot, { projectId: projectA }), 'session-a')
    assert.equal(runtime.storedSession(bot, { projectId: projectB }), 'session-b')
    assert.equal(runtime.projectForSession('session-a'), projectA)
    assert.equal(runtime.projectForSession('session-b'), projectB)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('main turn carries the current project into its session and prompt', async () => {
  const { dir, store } = await fresh()
  try {
    const project = path.join(dir, 'project-main')
    const asks = []
    const runtime = {
      mainProject: '',
      setMainProject(value) { this.mainProject = value },
      async ask(target, prompt, _signal, context) {
        asks.push({ target, prompt, context })
        return 'ok'
      },
    }
    const result = await askMain(store, runtime, { text: '检查一下', projectId: project })
    assert.equal(result.reply.text, 'ok')
    assert.equal(asks[0].context.projectId, project)
    assert.match(asks[0].prompt, /Current project/)
    assert.ok(asks[0].prompt.includes(project))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
