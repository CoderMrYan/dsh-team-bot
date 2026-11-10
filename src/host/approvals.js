/**
 * Human-approval gate for destructive team operations.
 *
 * A model-facing destructive tool never executes directly. Without an
 * approval id it creates a pending request; the Web command center shows the
 * request and the Lead approves or rejects it. Approval executes the action
 * server-side, so a model cannot silently self-approve.
 */
import { notifyMain } from './main.js'

/** Create or consume the approval for one destructive operation. */
export async function approvalGate(store, input, approvalId) {
  if (typeof approvalId !== 'string' || approvalId.trim() === '') {
    const approval = await store.createApproval({
      kind: input.kind,
      payload: input.payload,
      summary: input.summary,
      requestedBy: input.requestedBy ?? 'main',
    })
    await notifyMain(store, `[待审批] ${input.summary}\napproval_id: ${approval.id}`)
    return { approved: false, pending: approval }
  }
  const approval = await store.consumeApproval(approvalId, input.kind, input.payload)
  if (approval.alreadyExecuted === true) {
    return { approved: false, executed: true, approval }
  }
  return { approved: true, approval }
}

/** Execute the action behind an already approved request exactly once. */
export async function executeApproval(store, approvalId) {
  const approval = store.getApproval(approvalId)
  if (approval.status === 'executed') return { executed: true, approval }
  if (approval.status !== 'approved') throw new Error(`approval is not approved: ${approval.status}`)
  const payload = approval.payload ?? {}
  let result
  if (approval.kind === 'bot.delete') result = await store.deleteBot(payload.botId)
  else if (approval.kind === 'room.delete') result = await store.deleteRoom(payload.roomId)
  else if (approval.kind === 'team.delete') result = await store.deleteTeam(payload.teamId)
  else if (approval.kind === 'task.delete') result = await store.deleteTask(payload.taskId)
  else throw new Error(`unsupported approval kind: ${approval.kind}`)
  await store.finishApproval(approvalId, result)
  return { executed: true, approval: store.getApproval(approvalId), result }
}
