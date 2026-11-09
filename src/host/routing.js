/**
 * Turn routing for one room message.
 *
 * P0 is deterministic: explicit mentions first, then the chief in admin mode,
 * then the first `maxSpeakers` members in auto mode. P2 replaces the auto
 * branch with an LLM router and adds hop/parallel scheduling.
 */

/**
 * @param {object} room - room with `members`, `chiefId`, `policy`.
 * @param {object} message - message with `mentions`.
 * @returns {string[]} bot ids that should answer, in order.
 */
export function routeMessage(room, message) {
  const policy = room.policy ?? {}
  const members = Array.isArray(room.members) ? room.members : []
  const max = Number.isInteger(policy.maxSpeakers) ? policy.maxSpeakers : 3
  const senderId = message.sender?.type === 'bot' ? String(message.sender.id ?? '') : ''
  const mentioned = (message.mentions ?? []).filter((id) => members.includes(id) && id !== senderId)
  if (mentioned.length > 0) return mentioned.slice(0, max)
  // A bot message never fans out by itself: only an explicit mention relays.
  if (senderId !== '') return []
  if (policy.replyMode === 'admin') {
    return typeof room.chiefId === 'string' && members.includes(room.chiefId) ? [room.chiefId] : []
  }
  if (policy.replyMode === 'auto') return members.slice(0, Math.min(max, members.length))
  return []
}
