/**
 * Model-facing tools for dsh-team-bot P0.
 *
 * P0 stores profiles, rooms, messages and memory shells, and returns routing
 * decisions. P1 adds the real-Session runtime that turns `routed` into replies.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { askDirect, askRoom } from './actions.js'
import { createAtom, createPersonaItem } from './memory.js'

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
        return await askRoom(
          store,
          runtime,
          { roomId: args.room_id, text: args.text, mentions: args.mentions },
          exec.signal,
        )
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
      description: 'Read shared room memory and, when given a bot, that bot private memory.',
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

    defineTool({
      name: 'team_memory_remember',
      description:
        'Remember one fact in shared room memory or a bot private memory. Same key supersedes the old value; a near-duplicate is skipped.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        text: { type: 'string', required: true, description: 'The fact to remember.' },
        key: { type: 'string', description: 'Stable key; reusing it supersedes the old atom.' },
        scope: { type: 'string', enum: ['room', 'bot'], description: 'room (shared) or bot (private); defaults to room.' },
        bot_id: { type: 'string', description: 'Required when scope=bot.' },
        importance: { type: 'number', description: '0-1 importance, default 0.5.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        const atom = createAtom({
          text: args.text,
          key: args.key,
          importance: args.importance,
          source: 'tool',
        })
        if (args.scope === 'bot') {
          if (typeof args.bot_id !== 'string' || args.bot_id === '') throw new Error('bot_id is required when scope=bot')
          return await store.rememberBot(args.bot_id, atom)
        }
        return await store.rememberRoom(args.room_id, atom)
      },
    }),

    defineTool({
      name: 'team_memory_forget',
      description: 'Remove one shared or private memory atom by id.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        atom_id: { type: 'string', required: true, description: 'Memory atom id from team_room_memory.' },
        scope: { type: 'string', enum: ['room', 'bot'], description: 'room (shared) or bot (private); defaults to room.' },
        bot_id: { type: 'string', description: 'Required when scope=bot.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        if (args.scope === 'bot') {
          if (typeof args.bot_id !== 'string' || args.bot_id === '') throw new Error('bot_id is required when scope=bot')
          return { memory: await store.forgetBot(args.bot_id, args.atom_id) }
        }
        return { memory: await store.forgetRoom(args.room_id, args.atom_id) }
      },
    }),

    defineTool({
      name: 'team_memory_persona',
      description: 'Add one standing preference to a bot private memory (L3 persona).',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id; validates the bot belongs to this room.' },
        bot_id: { type: 'string', required: true, description: 'Bot id.' },
        text: { type: 'string', required: true, description: 'Standing preference, such as "回答控制在 100 字内".' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        const room = store.getRoom(args.room_id)
        if (!room.members.includes(args.bot_id)) throw new Error(`bot is not a member of this room: ${args.bot_id}`)
        return { memory: await store.addPersona(args.bot_id, createPersonaItem(args.text)) }
      },
    }),

    defineTool({
      name: 'team_memory_review',
      description: 'Accept, reject, or re-open one shared or private memory atom.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        atom_id: { type: 'string', required: true, description: 'Memory atom id.' },
        action: { type: 'string', required: true, enum: ['accept', 'reject', 'pending'], description: 'Review decision.' },
        scope: { type: 'string', enum: ['room', 'bot'], description: 'room (shared) or bot (private); defaults to room.' },
        bot_id: { type: 'string', description: 'Required when scope=bot.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        const review = args.action === 'accept' ? 'accepted' : args.action === 'reject' ? 'rejected' : 'pending'
        if (args.scope === 'bot') {
          if (typeof args.bot_id !== 'string' || args.bot_id === '') throw new Error('bot_id is required when scope=bot')
          return { memory: await store.reviewBot(args.bot_id, args.atom_id, review) }
        }
        return { memory: await store.reviewRoom(args.room_id, args.atom_id, review) }
      },
    }),

    defineTool({
      name: 'team_dm_ask',
      description: 'Send a private message to one bot and run it as a real Session turn. Returns the reply.',
      parameters: {
        bot_id: { type: 'string', required: true, description: 'Bot id.' },
        text: { type: 'string', required: true, description: 'Private message text.' },
      },
      output: jsonOutput(),
      timeoutMs: 600_000,
      async execute(args, exec) {
        return await askDirect(store, runtime, { botId: args.bot_id, text: args.text }, exec.signal)
      },
    }),

    defineTool({
      name: 'team_dm_history',
      description: 'Read the latest private messages with one bot, oldest first.',
      parameters: {
        bot_id: { type: 'string', required: true, description: 'Bot id.' },
        limit: { type: 'integer', description: 'Number of latest messages (1-500, default 50).' },
      },
      output: jsonOutput(),
      async execute(args) {
        return { messages: await store.directHistory(args.bot_id, args.limit) }
      },
    }),

    defineTool({
      name: 'team_dm_list',
      description: 'List private conversations with their bot profile and last activity.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        await store.init()
        return { directs: store.listDirects() }
      },
    }),

    defineTool({
      name: 'team_chief_desk',
      description: 'Talk privately to a room chief; the chief can post conclusions back with team_room_post.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id whose chief to talk to.' },
        text: { type: 'string', required: true, description: 'Private message text.' },
      },
      output: jsonOutput(),
      timeoutMs: 600_000,
      async execute(args, exec) {
        await store.init()
        const room = store.getRoom(args.room_id)
        if (room.chiefId === '') throw new Error('room has no chief')
        return await askDirect(store, runtime, {
          botId: room.chiefId,
          text: args.text,
          note: `你是房间「${room.name}」的总管（chief）。群里的任务由你拆解和汇总；要把结论发回群里时，用 team_room_post({ room_id: "${room.id}", text: "...", as: "bot", bot_id: "${room.chiefId}" })。`,
        }, exec.signal)
      },
    }),
  ]
}
