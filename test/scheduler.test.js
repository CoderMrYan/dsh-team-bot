import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { TaskScheduler } from '../src/host/scheduler.js'

async function fresh(maxConcurrent = 1) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-scheduler-'))
  const store = new TeamStore(dir)
  await store.init()
  const bots = [
    await store.createBot({ name: 'worker-a', role: 'work' }),
    await store.createBot({ name: 'worker-b', role: 'work' }),
  ]
  const tasks = [
    await store.createTask({ title: 'task a', ownerBotId: bots[0].id }),
    await store.createTask({ title: 'task b', ownerBotId: bots[1].id }),
  ]
  return { dir, store, bots, tasks, scheduler: new TaskScheduler(store, runtime(store), { maxConcurrent }) }
}

function runtime(store) {
  return {
    async ensureTaskWorkspace(taskId) {
      return path.join(store.root, 'workspace', 'tasks', taskId)
    },
    async ask(bot) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      return `${bot.name} done`
    },
  }
}

async function settle(scheduler) {
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    const status = scheduler.status()
    if (status.running.length === 0 && status.queued.length === 0) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

test('scheduler caps concurrency and drains queued tasks', async () => {
  const { dir, store, bots, tasks, scheduler } = await fresh(1)
  try {
    const first = await scheduler.schedule(tasks[0].id, bots[0].id)
    const second = await scheduler.schedule(tasks[1].id, bots[1].id)
    assert.equal(first.queued, true)
    assert.equal(second.queued, true)
    assert.equal(scheduler.status().running.length, 1)
    assert.equal(scheduler.status().queued.length, 1)
    assert.equal(store.getTask(tasks[1].id).status, 'queued')

    await settle(scheduler)
    assert.equal(scheduler.status().running.length, 0)
    assert.equal(scheduler.status().queued.length, 0)
    assert.equal(store.getTask(tasks[0].id).status, 'waiting')
    assert.equal(store.getTask(tasks[1].id).status, 'waiting')
  } finally {
    scheduler.close()
    await settle(scheduler)
    await rm(dir, { recursive: true, force: true })
  }
})

test('scheduler de-duplicates the same task', async () => {
  const { dir, store, bots, tasks, scheduler } = await fresh(2)
  try {
    await scheduler.schedule(tasks[0].id, bots[0].id)
    const duplicate = await scheduler.schedule(tasks[0].id, bots[0].id)
    assert.equal(duplicate.queued, true)
    assert.equal(scheduler.status().running.filter((id) => id === tasks[0].id).length, 1)
    await settle(scheduler)
    assert.equal(store.getTask(tasks[0].id).status, 'waiting')
  } finally {
    scheduler.close()
    await settle(scheduler)
    await rm(dir, { recursive: true, force: true })
  }
})
