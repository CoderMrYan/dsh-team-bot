/**
 * Model-facing tools for dsh-team-bot P0.
 *
 * P0 stores profiles, rooms, messages and memory shells, and returns routing
 * decisions. P1 adds the real-Session runtime that turns `routed` into replies.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import { askDirect, askRoom, assignTask } from './actions.js'
import { createAtom, createPersonaItem } from './memory.js'
import { composeTeam } from './compose.js'
import { commandState, ensureMain, notifyMain } from './main.js'
import { listTemplates } from './templates.js'

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
      name: 'team_main_ensure',
      description: 'Ensure the persistent Main Bot (the orchestrator agent with its own Session) exists; returns its id and the command-center state.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        const main = await ensureMain(store)
        const state = await commandState(store)
        return { main, state }
      },
    }),

    defineTool({
      name: 'team_main_status',
      description: 'Read the command center: Main Bot, bots, rooms, durable tasks, live bot presence and recent activity.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        return await commandState(store)
      },
    }),

    defineTool({
      name: 'team_task_create',
      description: 'Create one durable task owned by the team. Use this before assigning work so progress, blockers and artifacts are visible.',
      parameters: {
        title: { type: 'string', required: true, description: 'Short task title.' },
        brief: { type: 'string', description: 'Detailed brief, acceptance criteria and output path.' },
        owner_bot_id: { type: 'string', description: 'Optional bot id; empty means unassigned.' },
        room_id: { type: 'string', description: 'Optional room id for the result.' },
        team_id: { type: 'string', description: 'Optional team id.' },
        parent_id: { type: 'string', description: 'Optional parent task id for subtasks.' },
      },
      output: jsonOutput(),
      async execute(args) {
        return await store.createTask({
          title: args.title,
          brief: args.brief,
          ownerBotId: args.owner_bot_id,
          roomId: args.room_id,
          teamId: args.team_id,
          parentId: args.parent_id,
          createdBy: 'main',
        })
      },
    }),

    defineTool({
      name: 'team_task_assign',
      description: 'Assign a durable task to one bot and run it as a real Session turn. The runtime records tool calls, task steps and presence while it runs.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Task id.' },
        bot_id: { type: 'string', required: true, description: 'Owner bot id.' },
        instruction: { type: 'string', description: 'Optional extra instruction for this assignment.' },
      },
      output: jsonOutput(),
      timeoutMs: 600_000,
      async execute(args, exec) {
        return await assignTask(store, runtime, {
          taskId: args.task_id,
          botId: args.bot_id,
          instruction: args.instruction,
        }, exec.signal)
      },
    }),

    defineTool({
      name: 'team_task_update',
      description: 'Update one task status, progress, owner or current step. Use status done only when the deliverable is actually ready.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Task id.' },
        status: { type: 'string', enum: ['queued', 'running', 'waiting', 'blocked', 'done', 'failed'], description: 'New status.' },
        progress: { type: 'integer', description: '0-100.' },
        owner_bot_id: { type: 'string', description: 'New owner bot id.' },
        current_step: { type: 'string', description: 'Short current step label.' },
      },
      output: jsonOutput(),
      async execute(args) {
        return await store.updateTask(args.task_id, {
          status: args.status,
          progress: args.progress,
          ownerBotId: args.owner_bot_id,
          currentStep: args.current_step,
        })
      },
    }),

    defineTool({
      name: 'team_task_report',
      description: 'Report progress for the task you are executing. Call at start, at milestones, when blocked, and when done. This is what makes the bot visible in the command center.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Task id.' },
        bot_id: { type: 'string', required: true, description: 'Your bot id (the owner).' },
        status: { type: 'string', required: true, enum: ['running', 'waiting', 'blocked', 'done', 'failed'], description: 'Report status.' },
        message: { type: 'string', description: 'Human-readable progress or blocker.' },
        progress: { type: 'integer', description: '0-100; optional.' },
      },
      output: jsonOutput(),
      async execute(args) {
        const progress = args.status === 'done' ? 100 : args.progress
        await store.updateTask(args.task_id, {
          status: args.status,
          progress,
          currentStep: args.message,
        })
        await store.recordActivity({
          botId: args.bot_id,
          taskId: args.task_id,
          kind: 'report',
          label: args.status === 'blocked' ? '阻塞上报' : args.status === 'done' ? '任务完成' : '进度上报',
          detail: args.message,
          status: args.status === 'blocked' ? 'error' : 'done',
        })
        await store.setPresence(args.bot_id, {
          status: args.status === 'blocked' ? 'blocked' : args.status === 'done' ? 'idle' : 'waiting',
          taskId: args.status === 'done' ? '' : args.task_id,
          action: args.message ?? args.status,
        })
        const owner = store.getBot(args.bot_id)
        const task = store.getTask(args.task_id)
        await notifyMain(store, `[${args.status === 'blocked' ? '阻塞' : args.status === 'done' ? '完成' : '进度'}] ${owner.name} · ${task.title}\n${args.message ?? ''}`)
        return task
      },
    }),

    defineTool({
      name: 'team_task_artifact',
      description: 'Register one deliverable file path (inside the shared team workspace) on a task.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Task id.' },
        path: { type: 'string', required: true, description: 'Absolute path or workspace-relative path.' },
        name: { type: 'string', description: 'Optional display name.' },
      },
      output: jsonOutput(),
      async execute(args) {
        return await store.addTaskArtifact(args.task_id, {
          path: args.path,
          name: args.name ?? args.path.split(/[\\/]/).pop(),
        })
      },
    }),

    defineTool({
      name: 'team_task_list',
      description: 'List durable tasks, optionally filtered by owner, room or status.',
      parameters: {
        owner_bot_id: { type: 'string', description: 'Filter by owner bot id.' },
        room_id: { type: 'string', description: 'Filter by room id.' },
        status: { type: 'string', description: 'Filter by status.' },
      },
      output: jsonOutput(),
      async execute(args) {
        return {
          tasks: store.listTasks({
            ownerBotId: args.owner_bot_id,
            roomId: args.room_id,
            status: args.status,
          }),
        }
      },
    }),

    defineTool({
      name: 'team_task_get',
      description: 'Read one task with its steps, artifacts, owner and current status.',
      parameters: {
        task_id: { type: 'string', required: true, description: 'Task id.' },
      },
      output: jsonOutput(),
      async execute(args) {
        return await store.getTask(args.task_id)
      },
    }),

    defineTool({
      name: 'team_compose',
      description:
        'Create a whole team from one sentence: pick a built-in archetype, or let the hidden architect design roles for an arbitrary brief; creates all bots, one main room, and sub-rooms each with its own chief.',
      parameters: {
        brief: { type: 'string', required: true, description: 'What the user wants, such as "我要做一个短视频团队".' },
        template: { type: 'string', enum: ['short-video', 'software', 'content', 'research'], description: 'Optional explicit archetype; otherwise matched from the brief.' },
        name: { type: 'string', description: 'Optional team name; defaults to the template name.' },
      },
      output: jsonOutput(),
      timeoutMs: 120_000,
      async execute(args) {
        return await composeTeam(store, {
          brief: args.brief,
          templateId: args.template,
          name: args.name,
        }, runtime)
      },
    }),

    defineTool({
      name: 'team_template_list',
      description: 'List the built-in team archetypes that team_compose can create.',
      parameters: {},
      output: jsonOutput(),
      async execute() {
        return { templates: listTemplates() }
      },
    }),

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
        reply_mode: { type: 'string', enum: ['mention', 'admin', 'auto'], description: 'mention: only explicit @; admin: chief answers; auto: score bot profiles against the message, then fall back to the first max_speakers members.' },
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
      name: 'team_room_update',
      description: 'Update one room: members, chief, or reply policy. The same bot can be chief of several rooms.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
        members: { type: 'array', items: { type: 'string' }, description: 'New member bot ids.' },
        chief_id: { type: 'string', description: 'New chief bot id; must be a member.' },
        reply_mode: { type: 'string', enum: ['mention', 'admin', 'auto'], description: 'New reply mode.' },
        max_speakers: { type: 'integer', description: 'New max speakers (1-8).' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.updateRoom(args.room_id, {
          members: args.members,
          chiefId: args.chief_id,
          policy: {
            ...(args.reply_mode === undefined ? {} : { replyMode: args.reply_mode }),
            ...(args.max_speakers === undefined ? {} : { maxSpeakers: args.max_speakers }),
          },
        })
      },
    }),

    defineTool({
      name: 'team_rename',
      description: 'Rename a team and its main room. Sub-rooms keep their own names.',
      parameters: {
        team_id: { type: 'string', required: true, description: 'Team id from team_compose.' },
        name: { type: 'string', required: true, description: 'New team name.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.renameTeam(args.team_id, args.name)
      },
    }),

    defineTool({
      name: 'team_room_delete',
      description: 'Delete one room and its timeline/memory files.',
      parameters: {
        room_id: { type: 'string', required: true, description: 'Room id.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.deleteRoom(args.room_id)
      },
    }),

    defineTool({
      name: 'team_delete',
      description: 'Delete every room and bot that belongs to one team.',
      parameters: {
        team_id: { type: 'string', required: true, description: 'Team id from team_compose.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        return await store.deleteTeam(args.team_id)
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
        const scope = store.getRoom(args.room_id)
        const team = scope.teamId === '' ? undefined : await store.teamMemory(scope.teamId)
        const bot = typeof args.bot_id === 'string' && args.bot_id !== '' ? await store.botMemory(args.bot_id) : undefined
        return {
          room,
          ...(team === undefined ? {} : { team }),
          ...(bot === undefined ? {} : { bot }),
        }
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
        scope: { type: 'string', enum: ['room', 'team', 'bot'], description: 'room (shared), team (shared across the team), or bot (private); defaults to room.' },
        team_id: { type: 'string', description: 'Required when scope=team.' },
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
        if (args.scope === 'team') {
          if (typeof args.team_id !== 'string' || args.team_id === '') throw new Error('team_id is required when scope=team')
          return await store.rememberTeam(args.team_id, atom)
        }
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
        scope: { type: 'string', enum: ['room', 'team', 'bot'], description: 'room (shared), team (shared across the team), or bot (private); defaults to room.' },
        team_id: { type: 'string', description: 'Required when scope=team.' },
        bot_id: { type: 'string', description: 'Required when scope=bot.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        if (args.scope === 'team') {
          if (typeof args.team_id !== 'string' || args.team_id === '') throw new Error('team_id is required when scope=team')
          return { memory: await store.forgetTeam(args.team_id, args.atom_id) }
        }
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
        scope: { type: 'string', enum: ['room', 'team', 'bot'], description: 'room (shared), team (shared across the team), or bot (private); defaults to room.' },
        team_id: { type: 'string', description: 'Required when scope=team.' },
        bot_id: { type: 'string', description: 'Required when scope=bot.' },
      },
      output: jsonOutput(),
      async execute(args) {
        await store.init()
        const review = args.action === 'accept' ? 'accepted' : args.action === 'reject' ? 'rejected' : 'pending'
        if (args.scope === 'team') {
          if (typeof args.team_id !== 'string' || args.team_id === '') throw new Error('team_id is required when scope=team')
          return { memory: await store.reviewTeam(args.team_id, args.atom_id, review) }
        }
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
