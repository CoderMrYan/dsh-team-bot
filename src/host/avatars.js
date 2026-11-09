/**
 * Deterministic avatar descriptors for bots and rooms.
 *
 * The Host stores only `{ hue, variant }`; the Web panel draws the SVG. A hash
 * of the name keeps the avatar stable across restarts and Lets two rooms with
 * the same name still look related.
 */

const HUES = [210, 260, 160, 20, 340, 45, 190, 300, 120, 280, 0, 75]

/** @returns {number} 32-bit FNV-1a hash. */
export function hashSeed(seed) {
  let hash = 2166136261
  const value = String(seed ?? '')
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * @param {string} seed - usually the bot or room name.
 * @param {'bot'|'room'} [kind]
 * @returns {{hue:number, variant:number}}
 */
export function createAvatar(seed, kind = 'bot') {
  const hash = hashSeed(`${kind}:${seed}`)
  return {
    hue: HUES[hash % HUES.length],
    variant: Math.floor(hash / HUES.length) % 7,
  }
}

export { HUES }
