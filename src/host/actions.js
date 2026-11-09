/**
 * Room actions shared by the model tool and the Web API.
 */
import { buildRoomPrompt } from './runtime.js'

/**
 * Append a human message, run every routed bot as a real Session turn, and
 * append each non-empty reply back to the room.
 * @param {import('./store.js').TeamStore} store
 * @param {import('./runtime.js').BotRuntime} runtime
 * @param {{ roomId: string, text: string, mentions?: string[] }} input
 * @param {AbortSignal} [signal]
 * @returns {Promise<{posted: object, routed: string[], replies: object[]}>}
 */
export async function askRoom(store, runtime, input, signal) {
  await store.init()
  const room = store.getRoom(input.roomId)
  const { message, routed } = await store.postMessage({
    roomId: room.id,
    sender: { type: 'human', name: 'human' },
    text: input.text,
    mentions: input.mentions,
  })
  const replies = []
  for (const botId of routed) {
    const bot = store.getBot(botId)
    try {
      const history = await store.history(room.id, 12)
      const prompt = buildRoomPrompt(room, bot, history)
      const text = (await runtime.ask(bot, prompt, signal)).trim()
      if (text === '' || text === '[PASS]') {
        replies.push({ bot: bot.name, skipped: true })
        continue
      }
      const posted = await store.postMessage({
        roomId: room.id,
        sender: { type: 'bot', id: bot.id, name: bot.name },
        text,
      })
      replies.push({ bot: bot.name, message_id: posted.message.id, text })
    } catch (error) {
      replies.push({ bot: bot.name, error: error instanceof Error ? error.message : String(error) })
    }
  }
  return { posted: message, routed, replies }
}
