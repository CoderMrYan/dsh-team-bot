/**
 * Token-free team reporting: a compact brief and a low-frequency heartbeat.
 *
 * The brief is intentionally deterministic and cheap. It reads the durable task
 * ledger; it never starts a model turn. The heartbeat only records activity and
 * posts a Main Bot notification, so it cannot burn model quota.
 */
import { notifyMain } from './main.js'

const ATTENTION_STATUSES = new Set(['blocked', 'needs_approval', 'in_review'])

/** @returns {string} a compact one-line status summary for one task. */
function taskLine(task) {
  return `- ${task.id} [${task.status}] ${task.title} · owner ${task.ownerBotId || 'unassigned'} · review ${task.reviewStatus || 'none'} · ${task.progress ?? 0}%`
}

/**
 * Build a deterministic brief from the durable ledger.
 * @param {import('./store.js').TeamStore} store
 * @param {{ staleMs?: number, now?: number }} [options]
 */
export async function buildTeamBrief(store, options = {}) {
  await store.init()
  const now = Number.isFinite(options.now) ? options.now : Date.now()
  const staleMs = Number.isInteger(options.staleMs) ? options.staleMs : 1_800_000
  const tasks = store.listTasks(options.projectId === undefined || options.projectId === ''
    ? {}
    : { projectId: String(options.projectId) })
  const counts = {}
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1
  const attention = []
  let totalTokens = 0
  let totalWakes = 0
  const byBot = new Map()
  const stale = []
  for (const task of tasks) {
    const usage = task.usage ?? {}
    const tokens = Number(usage.totalTokens) || 0
    totalTokens += tokens
    totalWakes += Number(task.wakeCount) || 0
    if (task.ownerBotId !== '') {
      const row = byBot.get(task.ownerBotId) ?? { botId: task.ownerBotId, tasks: 0, tokens: 0, wakes: 0 }
      row.tasks += 1
      row.tokens += tokens
      row.wakes += Number(task.wakeCount) || 0
      byBot.set(task.ownerBotId, row)
    }
    if (ATTENTION_STATUSES.has(task.status)) attention.push(task)
    if (task.status === 'running') {
      const updated = Date.parse(task.updatedAt)
      if (Number.isFinite(updated) && now - updated >= staleMs) stale.push(task)
    }
  }
  const groups = Object.entries(counts).map(([status, count]) => ({ status, count }))
  const botUsage = [...byBot.values()]
    .map((row) => ({ ...row, name: store.state.bots[row.botId]?.name ?? row.botId }))
    .sort((left, right) => right.tokens - left.tokens)
  const lines = []
  lines.push(`任务：${groups.map((group) => `${group.status}=${group.count}`).join(' · ') || '无'}`)
  if (attention.length > 0) lines.push(`需要关注：\n${attention.slice(0, 8).map(taskLine).join('\n')}`)
  if (stale.length > 0) lines.push(`僵死 running：${stale.map((task) => task.title).join('、')}`)
  lines.push(`用量：${totalTokens.toLocaleString()} tokens · 唤醒 ${totalWakes} 次`)
  if (botUsage.length > 0) {
    lines.push(`Bot 用量：${botUsage.slice(0, 6).map((row) => `${row.name} ${row.tokens.toLocaleString()}t/${row.wakes}w`).join(' · ')}`)
  }
  return {
    generatedAt: new Date(now).toISOString(),
    counts,
    groups,
    attention: attention.map(taskLine),
    stale: stale.map(taskLine),
    totals: { tasks: tasks.length, tokens: totalTokens, wakes: totalWakes },
    byBot: botUsage,
    text: lines.join('\n'),
  }
}

/**
 * Run a low-frequency heartbeat. It never calls a model; it only records
 * activity and notifies the Main Bot, so it is safe to leave enabled.
 */
export function startHeartbeat(store, runtime, options = {}) {
  const intervalMs = Number.isInteger(options.intervalMs) && options.intervalMs >= 60_000
    ? options.intervalMs
    : 7_200_000
  const staleMs = Number.isInteger(options.staleMs) ? options.staleMs : 1_800_000
  const dailyHour = Number.isInteger(options.dailyHour) ? options.dailyHour : 8
  const dailyMinute = Number.isInteger(options.dailyMinute) ? options.dailyMinute : 0
  let lastDaily = ''
  let timer
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      await store.init()
      if (lastDaily === '') lastDaily = store.getHeartbeat().lastDaily
      const brief = await buildTeamBrief(store, { staleMs })
      const now = new Date()
      for (const line of brief.stale) {
        const taskId = line.match(/task-[a-z0-9]+/)?.[0] ?? ''
        await store.recordActivity({
          botId: '',
          taskId,
          kind: 'heartbeat',
          label: '心跳发现僵死任务',
          detail: line,
          status: 'error',
        }).catch(() => undefined)
      }
      const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const afterDaily = now.getHours() > dailyHour || (now.getHours() === dailyHour && now.getMinutes() >= dailyMinute)
      if (afterDaily && lastDaily !== localDate) {
        lastDaily = localDate
        await notifyMain(store, `[每日简报] ${localDate}\n${brief.text}`).catch(() => undefined)
        await store.recordActivity({
          botId: '',
          kind: 'brief',
          label: '每日简报',
          detail: brief.text,
          status: 'done',
        }).catch(() => undefined)
      }
      await store.setHeartbeat({
        lastAt: brief.generatedAt,
        lastDaily,
        attention: brief.attention.length,
        tokens: brief.totals.tokens,
      }).catch(() => undefined)
    } catch {
      // Reporting must never crash the host.
    } finally {
      running = false
    }
  }

  timer = setInterval(tick, intervalMs)
  timer.unref?.()
  void tick()
  return () => clearInterval(timer)
}
