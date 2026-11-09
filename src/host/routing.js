/**
 * Turn routing for one room message.
 *
 * Explicit mentions win; admin mode goes to the chief; auto mode scores each
 * member's profile (name, role, persona) against the message tokens, then falls
 * back to the first `maxSpeakers` members when nothing matches.
 */
import { tokenize } from './memory.js'

/** @returns {number} profile-token overlap for one bot. */
function profileScore(bot, queryTokens) {
  if (bot === undefined || queryTokens.size === 0) return 0
  const tokens = new Set(tokenize(`${bot.name} ${bot.role} ${bot.persona}`))
  let score = 0
  for (const token of queryTokens) if (tokens.has(token)) score += 1
  return score
}

/**
 * @param {object} room - room with `members`, `chiefId`, `policy`.
 * @param {object} message - message with `mentions` and `text`.
 * @param {Record<string, object>} [bots] - bot profiles keyed by id.
 * @returns {string[]} bot ids that should answer, in order.
 */
export function routeMessage(room, message, bots = {}) {
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
  if (policy.replyMode === 'auto') {
    const query = new Set(tokenize(message.text ?? ''))
    const candidates = members.filter((id) => id !== senderId)
    const scored = candidates.map((id, index) => ({ id, index, score: profileScore(bots[id], query) }))
    const relevant = scored.filter((entry) => entry.score > 0)
    const ranked = relevant.length > 0
      ? relevant.sort((left, right) => right.score - left.score || left.index - right.index)
      : scored
    return ranked.slice(0, Math.min(max, ranked.length)).map((entry) => entry.id)
  }
  return []
}
