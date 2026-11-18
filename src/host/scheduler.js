/**
 * Durable task scheduler.
 *
 * `team_task_dispatch` must return immediately: the Main Bot should be able to
 * keep coordinating while a worker turn runs in the background. The scheduler
 * owns the process-local queue, the concurrency cap, and completion notices.
 * The task ledger remains the durable source of truth; on restart, queued tasks
 * are re-enqueued by `resume()`.
 */
import { assignTask } from './actions.js'
import { notifyMain } from './main.js'

export class TaskScheduler {
  /**
   * @param {import('./store.js').TeamStore} store
   * @param {import('./runtime.js').BotRuntime} runtime
   * @param {{ maxConcurrent?: number }} [options]
   */
  constructor(store, runtime, options = {}) {
    this.store = store
    this.runtime = runtime
    this.maxConcurrent = Number.isInteger(options.maxConcurrent) && options.maxConcurrent > 0
      ? options.maxConcurrent
      : 2
    this.queue = []
    this.running = new Map()
    this.draining = false
    this.closed = false
  }

  /** @returns {{ running: string[], queued: string[], maxConcurrent: number }} */
  status() {
    return {
      running: [...this.running.keys()],
      queued: this.queue.map((item) => item.taskId),
      maxConcurrent: this.maxConcurrent,
    }
  }

  /** @returns {boolean} whether this task is already owned by the scheduler. */
  has(taskId) {
    return this.running.has(taskId) || this.queue.some((item) => item.taskId === taskId)
  }

  /**
   * Put one task in the queue and start it when capacity allows.
   * @returns {Promise<{ task: object, queued: boolean, position: number }>}
   */
  async schedule(taskId, botId, instruction = '', options = {}) {
    await this.store.init()
    if (this.closed) throw new Error('task scheduler is closed')
    const task = this.store.getTask(taskId)
    const bot = this.store.getBot(botId)
    if (task.reviewerBotId !== '' && task.reviewerBotId === bot.id) {
      throw new Error('the reviewer cannot be the task owner')
    }
    if (this.has(task.id)) {
      return { task: this.store.getTask(task.id), queued: true, position: this.queue.findIndex((item) => item.taskId === task.id) + 1 }
    }
    if (['done', 'in_review', 'needs_approval', 'failed', 'cancelled'].includes(task.status)) {
      throw new Error(`task cannot be dispatched from status ${task.status}`)
    }
    if (task.status === 'running' && options.force !== true) {
      return { task, queued: false, position: 0 }
    }
    await this.store.updateTask(task.id, {
      ownerBotId: bot.id,
      status: 'queued',
      currentStep: '进入执行队列',
    })
    await this.store.addTaskStep(task.id, {
      kind: 'queue',
      label: '进入执行队列',
      detail: instruction,
      status: 'done',
    })
    await this.store.setPresence(bot.id, { status: 'waiting', taskId: task.id, action: '排队等待执行' }).catch(() => undefined)
    this.queue.push({ taskId: task.id, botId: bot.id, instruction })
    const position = this.queue.length
    this.drain()
    return { task: this.store.getTask(task.id), queued: true, position }
  }

  /**
   * Cancel one queued or running task.
   * @param {string} taskId
   * @param {string} [reason]
   * @returns {Promise<object>} the cancelled task
   */
  async cancel(taskId, reason = '') {
    await this.store.init()
    const task = this.store.getTask(taskId)
    const queueIndex = this.queue.findIndex((item) => item.taskId === taskId)
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1)
    if (this.running.has(taskId)) {
      try {
        this.runtime.cancelTaskSession(task.ownerBotId, taskId)
      } catch {
        // The Session may already have settled.
      }
    }
    const cancelled = await this.store.cancelTask(taskId, reason)
    if (cancelled.ownerBotId !== '') {
      await this.store.setPresence(cancelled.ownerBotId, { status: 'idle', taskId: '', action: '任务已取消' }).catch(() => undefined)
    }
    await this.store.recordActivity({
      botId: cancelled.ownerBotId,
      taskId: cancelled.id,
      kind: 'cancel',
      label: '任务已取消',
      detail: String(reason),
      status: 'error',
    })
    await notifyMain(this.store, `[已取消] ${cancelled.title}${reason ? `\n${reason}` : ''}`, cancelled.projectId).catch(() => undefined)
    return cancelled
  }

  /** Start queued work until the concurrency cap is reached. */
  drain() {
    if (this.draining || this.closed) return
    this.draining = true
    try {
      while (!this.closed && this.running.size < this.maxConcurrent && this.queue.length > 0) {
        const item = this.queue.shift()
        this.running.set(item.taskId, item)
        void this.run(item)
      }
    } finally {
      this.draining = false
    }
  }

  /** Run one scheduled task and always release its slot. */
  async run(item) {
    let finished
    try {
      finished = await assignTask(this.store, this.runtime, item)
      await this.store.recordActivity({
        botId: item.botId,
        taskId: item.taskId,
        kind: 'queue',
        label: '后台任务结束',
        detail: finished?.task?.status ?? '',
        status: finished?.task?.status === 'failed' ? 'error' : 'done',
      }).catch(() => undefined)
      await notifyMain(this.store, `[后台任务] ${finished?.task?.title ?? item.taskId} 已结束，状态 ${finished?.task?.status ?? 'unknown'}`, finished?.task?.projectId ?? '').catch(() => undefined)
    } catch (error) {
      await this.store.recordActivity({
        botId: item.botId,
        taskId: item.taskId,
        kind: 'error',
        label: '后台任务失败',
        detail: error instanceof Error ? error.message : String(error),
        status: 'error',
      }).catch(() => undefined)
      let projectId = ''
      try { projectId = this.store.getTask(item.taskId).projectId } catch { projectId = '' }
      await notifyMain(this.store, `[后台任务失败] ${item.taskId}: ${error instanceof Error ? error.message : String(error)}`, projectId).catch(() => undefined)
    } finally {
      this.running.delete(item.taskId)
      if (!this.closed) this.drain()
    }
  }

  /** Re-enqueue durable queued tasks after a plugin restart. */
  async resume() {
    await this.store.init()
    const queued = this.store.listTasks({ status: 'queued' })
      .filter((task) => task.ownerBotId !== '')
      .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    for (const task of queued) {
      if (!this.has(task.id)) {
        await this.schedule(task.id, task.ownerBotId, task.currentStep)
      }
    }
  }

  /** Stop accepting work and release queued entries. */
  close() {
    this.closed = true
    this.queue = []
  }
}
