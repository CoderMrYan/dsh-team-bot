/**
 * Bridge DSH's tool-approval waterfall into the team command center.
 *
 * A DSH tool that needs permission emits `approval/request` on the Host and
 * waits for an answerer. Team bots run in headless Sessions, so without this
 * bridge the request has no visible UI and the turn can sit forever. We only
 * claim requests whose Session belongs to one of our bots; every other request
 * is delegated with `next()`.
 */
import { notifyMain } from './main.js'

/** @returns {object|undefined} the bot profile owning a Session id. */
function botForSession(store, sessionId) {
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  return store.listBots({ includeHidden: true }).find(
    (bot) => String(bot.sessionId) === String(sessionId) || String(bot.taskSessionId) === String(sessionId),
  )
}

/**
 * Install the approval bridge.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {import('./store.js').TeamStore} store
 */
export function installToolApprovalBridge(ctx, store) {
  const pending = new Map()
  const disposers = []
  const stats = { seen: 0, claimed: 0, lastSessionId: '', lastTool: '' }

  const settle = async (approvalId, outcome) => {
    const entry = pending.get(approvalId)
    if (entry === undefined) return false
    pending.delete(approvalId)
    try {
      await store.resolveApproval(approvalId, outcome === 'allowed-once' ? 'approved' : 'rejected')
    } catch {
      // A request may have been swept after a restart.
    }
    entry.resolve(outcome)
    return true
  }

  const onRequest = async (request, next) => {
    const sessionId = request?.agent?.id
      ?? request?.agent?.session?.id
      ?? request?.agent?.sessionId
      ?? ''
    stats.seen += 1
    stats.lastSessionId = String(sessionId)
    stats.lastTool = String(request?.toolName ?? '')
    let bot
    try {
      await store.init()
      bot = botForSession(store, sessionId)
    } catch {
      bot = undefined
    }
    if (bot === undefined) return next()

    stats.claimed += 1

    const key = `${sessionId}:${request.callId ?? ''}`
    const existing = [...pending.values()].find((entry) => entry.key === key)
    if (existing !== undefined) return await existing.promise

    let approval
    try {
      approval = await store.createApproval({
        kind: 'tool.approval',
        payload: {
          sessionId,
          toolName: String(request.toolName ?? ''),
          callId: String(request.callId ?? ''),
        },
        summary: `${bot.name} 请求工具「${request.toolName}」权限${request.reason ? `：${request.reason}` : ''}`,
        requestedBy: bot.id,
      })
      await notifyMain(store, `[需要授权] ${bot.name} 请求执行「${request.toolName}」。\napproval_id: ${approval.id}`)
    } catch {
      return 'unavailable'
    }

    let resolvePromise
    const promise = new Promise((resolve) => { resolvePromise = resolve })
    const entry = {
      key,
      promise,
      resolve: (outcome) => resolvePromise(outcome),
    }
    pending.set(approval.id, entry)

    const abort = () => {
      if (!pending.has(approval.id)) return
      pending.delete(approval.id)
      store.resolveApproval(approval.id, 'rejected').catch(() => undefined)
      resolvePromise('cancelled')
    }
    if (request.signal !== undefined) {
      if (request.signal.aborted) abort()
      else request.signal.addEventListener('abort', abort, { once: true })
    }
    return await promise
  }

  disposers.push((ctx.events ?? ctx.root ?? ctx).on('approval/request', onRequest))
  return {
    resolve: settle,
    pending: () => [...pending.keys()],
    stats: () => ({ ...stats, pending: pending.size }),
    dispose: () => {
      for (const dispose of disposers.reverse()) {
        try { dispose() } catch { /* ignore */ }
      }
      for (const entry of pending.values()) entry.resolve('cancelled')
      pending.clear()
    },
  }
}
