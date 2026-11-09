/**
 * Model-facing tools for dsh-team-bot P0.
 *
 * P0 stores profiles, rooms, messages and memory shells, and returns routing
 * decisions. P1 adds the real-Session runtime that turns `routed` into replies.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildRoomPrompt } from './runtime.js'

const ANY_OBJECT = { type: 'object', additionalProperties: true }

/** @returns {object} a tool output that renders the canonical value as compact JSON. */
function jsonOutput(schema = ANY_OBJECT) {
  return {
    schema,
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
  }
}

/**
 * Build every tool against one store and the real-Session runtime.
 * @param {import('./store.js').TeamStore} store
 * @param {import('./runtime.js').BotRuntime} runtime
 * @returns {object[]} tool definitions ready for `ctx.tools.register()`.
 */
export function createTools(store, runtime) {
  return [
    defineTool({
      name: 'team_bot_create',
      description:
        'Create one named bot profile (role, persona, model, workspace). A profile is not a live Session until the runtime binds it.',
      parameters: {
        name: { type: 'string', required: true, description: 'Unique display name.' },
        role: { type: 'string', required: true, description: 'Short responsibility, such as researcher or reviewer.' },
        persona: { type: 'string', description: 'Standing instructions for this bot.' },
        model: { type: 'string', description: 'Optional provider/model id.' },
        workspace: { type: 'string', description: 'Optional working directory for this bot.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.createBot(args)
      },
    }),

    defineTool({
      name: 'team_bot_list',
      description: 'List every bot profile in this team.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        await store.init()
        return { bots: store.listBots() }
      },
    }),

    defineTool({
      name: 'team_room_create',
      description:
        'Create one shared room with a member list, a chief, and a reply policy. Mention routing is the default.',
      parameters: {
        name: { type: 'string', required: true, description: 'Unique room name.' },
        members: { type: 'array', items: { type: 'string' }, description: 'Bot ids to include; the first defaults to chief.' },
        chief_id: { type: 'string', description: 'Bot id of the chief; must be a member. Defaults to the first member.' },
        reply_mode: { type: 'string', enum: ['mention', 'admin', 'auto'], description: 'mention: only explicit @; admin: chief answers; auto: first max_speakers members.' },
        max_speakers: { type: 'integer', description: 'Maximum bots routed per message (1-8, default 3).' },
        hop_limit: { type: 'integer', description: 'Maximum relay hops (0-5, default 2).' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.createRoom({
          name: args.name,
          members: args.members,
          chiefId: args.chief_id,
          policy: {
            replyMode: args.reply_mode,
            maxSpeakers: args.max_speakers,
            hopLimit: args.hop_limit,
          },
        })
      },
    }),

    defineTool({
      name: 'team_room_list',
      description: 'List every shared room with its members, chief, and reply policy.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        await store.init()
        return { rooms: store.listRooms() }
      },
    }),

    defineTool({
      name: 'team_room_post',
      description:
        'Append one message to a room and return the bots routed to answer. P0 stores the decision; it does not run the bots yet.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id from team_room_create or team_room_list.' },
        text: { type: 'string', required: true, description: 'Message text.' },
        mentions: { type: 'array', items: { type: 'string' }, description: 'Bot ids explicitly mentioned.' },
        as: { type: 'string', enum: ['human', 'bot'], description: 'Sender kind; defaults to human.' },
        bot_id: { type: 'string', description: 'Required when as=bot; the sending bot id.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        let sender
        if (args.as === 'bot') {
          if (typeof args.bot_id !== 'string' || args.bot_id === '') throw new Error('bot_id is required when as=bot')
          const bot = store.getBot(args.bot_id)
          sender = { type: 'bot', id: bot.id, name: bot.name }
        } else {
          sender = { type: 'human', name: 'human' }
        }
        return await store.postMessage({
          roomId: args.room_id,
          sender,
          text: args.text,
          mentions: args.mentions,
        })
      },
    }),

    defineTool({
      name: 'team_room_ask',
      description:
        'Post a human message and run the routed bots as real DSH Session turns. Returns each bot reply and appends it to the room timeline.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        text: { type: 'string', required: true, description: 'Human message text.' },
        mentions: { type: 'array', items: { type: 'string' }, description: 'Bot ids explicitly mentioned.' },
      },
      output: jsonOutput(),
      timeoutMs: 600_000,
      async execute(args, exec) {
        await store.init()
        const room = store.getRoom(args.room_id)
        const { message, routed } = await store.postMessage({
          roomId: room.id,
          sender: { type: 'human', name: 'human' },
          text: args.text,
          mentions: args.mentions,
        })
        const replies = []
        for (const botId of routed) {
          const bot = store.getBot(botId)
          try {
            const history = await store.history(room.id, 12)
            const prompt = buildRoomPrompt(room, bot, history)
            const text = (await runtime.ask(bot, prompt, exec.signal)).trim()
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
      },
    }),

    defineTool({
      name: 'team_room_history',
      description: 'Read the latest messages in a room, oldest first.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        limit: { type: 'integer', description: 'Number of latest messages (1-500, default 50).' },
      },
      output: jsonOutput(),
      async execute(args) {
        return { messages: await store.history(args.room_id, args.limit) }
      },
    }),

    defineTool({
      name: 'team_room_memory',
      description: 'Read shared room memory and, when given a bot, that bot private memory. P3 fills these stores.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        bot_id: { type: 'string', description: 'Optional bot id for its private memory.' },
      },
      output: jsonOutput(),
      async execute(args) {
        const room = await store.roomMemory(args.room_id)
        const bot = typeof args.bot_id === 'string' && args.bot_id !== '' ? await store.botMemory(args.bot_id) : undefined
        return bot === undefined ? { room } : { room, bot }
      },
    }),
  ]
}
