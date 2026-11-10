/**
 * Lightweight task watchdog. It does not spend model tokens; it marks tasks
 * whose owner has stopped reporting and puts the alert into the activity feed
 * so the Main Bot (or the human) can act.
 */
import { notifyMain } from './main.js'

export function startWatchdog(store, runtime, options = {}) {
  const intervalMs = Number.isInteger(options.intervalMs) ? options.intervalMs : 15_000
  const staleMs = Number.isInteger(options.staleMs) ? options.staleMs : 90_000
  const alerted = new Set()
  let timer

  const tick = async () => {
    try {
      await store.init()
      const now = Date.now()
      const active = store.listTasks({ status: ['running'] })
      for (const task of active) {
        const updated = Date.parse(task.updatedAt)
        if (!Number.isFinite(updated) || now - updated < staleMs) continue
        if (alerted.has(task.id)) continue
        alerted.add(task.id)
        await store.recordActivity({
          botId: task.ownerBotId,
          taskId: task.id,
          kind: 'watchdog',
          label: '长时间没有新进展',
          detail: `任务「${task.title}」已经 ${Math.round((now - updated) / 1000)} 秒没有更新，需要主 Bot 或人类介入。`,
          status: 'error',
        })
        if (task.ownerBotId !== '') {
          await store.setPresence(task.ownerBotId, {
            status: 'waiting',
            taskId: task.id,
            action: '长时间没有新进展，等待介入',
          })
        }
        await notifyMain(store, `[看门狗] 任务「${task.title}」长时间没有新进展，请检查或重新派发。`)
      }
      for (const task of store.listTasks({ status: ['done', 'failed', 'blocked'] })) {
        alerted.delete(task.id)
      }
    } catch {
      // Observability must never crash the host.
    }
  }

  timer = setInterval(tick, intervalMs)
  timer.unref?.()
  return () => clearInterval(timer)
}
