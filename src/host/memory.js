/**
 * Memory for dsh-team-bot (P3 MVP).
 *
 * L0 is the room JSONL. This module owns L1 atoms, L2 extractive summaries and
 * L3 persona items, plus a deterministic BM25-lite recall. It is deliberately
 * model-free: explicit "remember" instructions and a rolling extractive summary
 * work without spending another model turn. P3.5 can swap in an LLM extractor
 * behind the same store shape.
 */
import { randomUUID } from 'node:crypto'

const CJK_RUN = /[\u4e00-\u9fff]+/g
const WORD = /[a-z0-9_]{2,}/g
const TRIGGERS = ['记住', '以后', '决定', '规则是', '不要', '必须', '约定']
const MAX_ATOMS = 40
const MAX_PERSONA = 12

/** @returns {string[]} CJK bigrams plus ASCII words. */
export function tokenize(text) {
  const lower = String(text ?? '').toLowerCase()
  const tokens = new Set()
  for (const word of lower.match(WORD) ?? []) tokens.add(word)
  for (const run of lower.match(CJK_RUN) ?? []) {
    if (run.length === 1) tokens.add(run)
    for (let index = 0; index < run.length - 1; index += 1) tokens.add(run.slice(index, index + 2))
  }
  return [...tokens]
}

/** @returns {number} Jaccard similarity between two token sets. */
export function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0
  let intersection = 0
  for (const token of left) if (right.has(token)) intersection += 1
  const union = left.size + right.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** @returns {object} an empty memory document. */
export function defaultMemory() {
  return { atoms: [], summary: '', persona: [], updatedAt: 0 }
}

/** @returns {object} a normalized memory document loaded from disk. */
export function normalizeMemory(value) {
  return {
    atoms: Array.isArray(value?.atoms) ? value.atoms.filter((atom) => typeof atom?.text === 'string') : [],
    summary: typeof value?.summary === 'string' ? value.summary : '',
    persona: Array.isArray(value?.persona) ? value.persona.filter((item) => typeof item?.text === 'string') : [],
    updatedAt: Number.isFinite(value?.updatedAt) ? value.updatedAt : 0,
  }
}

/**
 * Create one atom.
 * @param {{text:string, key?:string, importance?:number, source?:string, sourceMessageId?:string, review?:'accepted'|'pending'|'rejected'}} input
 */
export function createAtom(input) {
  const text = String(input.text ?? '').trim().slice(0, 600)
  if (text === '') throw new Error('memory text is required')
  return {
    id: `mem-${randomUUID().slice(0, 8)}`,
    key: String(input.key ?? text.slice(0, 24)).trim().slice(0, 80),
    text,
    importance: Number.isFinite(input.importance) ? Math.min(1, Math.max(0, input.importance)) : 0.5,
    source: String(input.source ?? 'manual'),
    sourceMessageId: String(input.sourceMessageId ?? ''),
    review: input.review === 'pending' || input.review === 'rejected' ? input.review : 'accepted',
    hits: 0,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Insert or supersede one atom. Same `key` replaces the old value; a near-duplicate
 * text is skipped; the list is capped by importance.
 * @returns {{atoms: object[], added?: true, replaced?: true, skipped?: true}}
 */
export function mergeAtoms(atoms, atom, limit = MAX_ATOMS) {
  const current = Array.isArray(atoms) ? atoms : []
  const sameKey = current.findIndex((item) => item.key === atom.key)
  if (sameKey >= 0) {
    const next = [...current]
    next[sameKey] = {
      ...atom,
      id: current[sameKey].id,
      createdAt: current[sameKey].createdAt,
      hits: current[sameKey].hits ?? 0,
    }
    return { atoms: next, replaced: true }
  }
  const tokens = new Set(tokenize(atom.text))
  const near = current.some((item) => jaccard(new Set(tokenize(item.text)), tokens) >= 0.8)
  if (near) return { atoms: current, skipped: true }
  const next = [...current, atom]
  if (next.length > limit) {
    next.sort((left, right) => (right.importance ?? 0) - (left.importance ?? 0))
    next.length = limit
  }
  return { atoms: next, added: true }
}

/**
 * BM25-lite recall: token overlap plus a small importance prior.
 * @returns {object[]} the best `limit` accepted atoms.
 */
export function recallAtoms(query, atoms, limit = 6) {
  const queryTokens = new Set(tokenize(query))
  if (queryTokens.size === 0) return []
  const scored = []
  for (const atom of Array.isArray(atoms) ? atoms : []) {
    if (atom.review !== 'accepted') continue
    const tokens = new Set(tokenize(`${atom.key} ${atom.text}`))
    let overlap = 0
    for (const token of queryTokens) if (tokens.has(token)) overlap += 1
    if (overlap === 0) continue
    scored.push({ atom, score: overlap + (atom.importance ?? 0.5) * 0.5 })
  }
  scored.sort((left, right) => right.score - left.score)
  return scored.slice(0, limit).map((entry) => entry.atom)
}

/** @returns {object|undefined} an atom captured from an explicit human instruction. */
export function captureFromHuman(text, messageId) {
  const value = String(text ?? '')
  if (!TRIGGERS.some((trigger) => value.includes(trigger))) return undefined
  return createAtom({
    text: value.slice(0, 300),
    key: value.slice(0, 20),
    importance: 0.8,
    source: 'auto',
    sourceMessageId: messageId,
    review: value.includes('记住') ? 'accepted' : 'pending',
  })
}

/** @returns {string} a bounded extractive digest of the latest messages. */
export function buildSummary(messages, maxChars = 700) {
  const lines = []
  for (const message of (messages ?? []).slice(-8)) {
    const who = message.sender?.type === 'bot' ? message.sender.name : 'human'
    lines.push(`[${who}] ${String(message.text ?? '').slice(0, 200)}`)
  }
  let summary = ''
  for (let index = lines.length - 1; index >= 0 && summary.length < maxChars; index -= 1) {
    summary = `${lines[index]}\n${summary}`
  }
  return summary.trim().slice(0, maxChars)
}

/**
 * Render the memory block injected into a bot prompt.
 * @returns {string} empty when there is nothing to inject.
 */
export function formatMemory(roomMemory, botMemory, query, teamMemory) {
  const parts = []
  if (typeof teamMemory?.summary === 'string' && teamMemory.summary.trim() !== '') {
    parts.push(`Shared team summary:\n${teamMemory.summary.trim()}`)
  }
  const teamAtoms = recallAtoms(query, teamMemory?.atoms, 4)
  if (teamAtoms.length > 0) {
    parts.push(`Shared team facts:\n${teamAtoms.map((atom) => `- ${atom.text}`).join('\n')}`)
  }
  if (typeof roomMemory?.summary === 'string' && roomMemory.summary.trim() !== '') {
    parts.push(`Shared room summary:\n${roomMemory.summary.trim()}`)
  }
  const roomAtoms = recallAtoms(query, roomMemory?.atoms, 4)
  if (roomAtoms.length > 0) {
    parts.push(`Shared facts:\n${roomAtoms.map((atom) => `- ${atom.text}`).join('\n')}`)
  }
  const botAtoms = recallAtoms(query, botMemory?.atoms, 4)
  if (typeof botMemory?.summary === 'string' && botMemory.summary.trim() !== '') {
    parts.push(`Your private summary:\n${botMemory.summary.trim()}`)
  }
  if (botAtoms.length > 0) {
    parts.push(`Your private memory:\n${botAtoms.map((atom) => `- ${atom.text}`).join('\n')}`)
  }
  const persona = Array.isArray(botMemory?.persona) ? botMemory.persona.slice(0, 4) : []
  if (persona.length > 0) {
    parts.push(`Your standing preferences:\n${persona.map((item) => `- ${item.text}`).join('\n')}`)
  }
  return parts.join('\n\n')
}

/** @returns {object} a normalized persona item. */
export function createPersonaItem(text) {
  const value = String(text ?? '').trim().slice(0, 300)
  if (value === '') throw new Error('persona text is required')
  return { id: `per-${randomUUID().slice(0, 8)}`, text: value, createdAt: new Date().toISOString() }
}

export { MAX_ATOMS, MAX_PERSONA }
