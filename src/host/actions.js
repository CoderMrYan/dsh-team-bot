/**
 * Room actions shared by the model tool and the Web API.
 */
import { buildDirectPrompt, buildRoomPrompt } from './runtime.js'
import { buildSummary, captureFromHuman } from './memory.js'

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
  const captured = captureFromHuman(message.text, message.id)
  if (captured !== undefined) await store.rememberRoom(room.id, captured)
  const roomMemory = await store.roomMemory(room.id)
  const teamMemory = room.teamId === '' ? undefined : await store.teamMemory(room.teamId)
  for (const botId of routed) {
    const bot = store.getBot(botId)
    try {
      const history = await store.history(room.id, 12)
      const botMemory = await store.botMemory(bot.id)
      const query = [message.text, ...history.slice(-3).map((item) => item.text)].join('\n')
      const prompt = buildRoomPrompt(room, bot, history, { roomMemory, botMemory, teamMemory, query })
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
  await store.setRoomSummary(room.id, buildSummary(await store.history(room.id, 8)))
  return { posted: message, routed, replies }
}

/**
 * Append a human direct message, run one bot as a real Session turn, and append
 * its reply. Private memory and a private summary are the only context.
 */
export async function askDirect(store, runtime, input, signal) {
  await store.init()
  const bot = store.getBot(input.botId)
  const posted = await store.postDirect({
    botId: bot.id,
    sender: { type: 'human', name: 'human' },
    text: input.text,
  })
  const captured = captureFromHuman(input.text, posted.id)
  if (captured !== undefined) await store.rememberBot(bot.id, captured)
  const history = await store.directHistory(bot.id, 12)
  const botMemory = await store.botMemory(bot.id)
  const query = [input.text, ...history.slice(-3).map((item) => item.text)].join('\n')
  const text = (await runtime.ask(bot, buildDirectPrompt(bot, history, { botMemory, query }, input.note), signal)).trim()
  if (text === '' || text === '[PASS]') return { posted, reply: undefined }
  const reply = await store.postDirect({
    botId: bot.id,
    sender: { type: 'bot', id: bot.id, name: bot.name },
    text,
  })
  await store.setBotSummary(bot.id, buildSummary(await store.directHistory(bot.id, 8)))
  return { posted, reply }
}
