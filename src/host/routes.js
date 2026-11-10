/**
 * Browser HTTP surface for the P2 panel.
 *
 * Routes live under `/dsh-team-bot/api` and are same-origin only. They read the
 * same store and runtime the model tools use, so the panel and the agent never
 * diverge.
 */
import { askDirect, askRoom, assignTask, handoffTask } from './actions.js'
import { askMain, commandState, ensureMain } from './main.js'
import { createAtom } from './memory.js'
import { composeTeam } from './compose.js'
import { listTemplates } from './templates.js'

const PREFIX = '/dsh-team-bot/api'

/** @returns {void} */
function sendJson(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** @returns {Promise<object>} the parsed JSON body. */
async function readJson(req, limit = 1_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Register the panel API on the Host web server.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {import('./store.js').TeamStore} store
 * @param {import('./runtime.js').BotRuntime} runtime
 * @returns {() => void} route disposer
 */
export function registerRoutes(ctx, store, runtime) {
  return ctx.webServer.register({
    kind: 'prefix',
    path: PREFIX,
    async handler(req, res) {
      try {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        const parts = url.pathname.slice(PREFIX.length).split('/').filter(Boolean)
        await store.init()
        if (parts[0] === 'health') {
          sendJson(res, 200, { ok: true })
          return
        }
        if (parts[0] === 'state' && req.method === 'GET') {
          await store.init()
          const main = await ensureMain(store)
          sendJson(res, 200, {
            bots: store.listBots(),
            rooms: store.listRooms(),
            tasks: store.listTasks(),
            presence: store.listPresence(),
            activity: store.listActivity({ limit: 80 }),
            main,
          })
          return
        }
        if (parts[0] === 'main' && parts.length === 1 && req.method === 'GET') {
          sendJson(res, 200, await commandState(store))
          return
        }
        if (parts[0] === 'main' && parts[1] === 'ask' && req.method === 'POST') {
          const body = await readJson(req)
          const text = typeof body.text === 'string' ? body.text.trim() : ''
          if (text === '') {
            sendJson(res, 400, { error: 'text is required' })
            return
          }
          sendJson(res, 200, await askMain(store, runtime, { text }))
          return
        }
        if (parts[0] === 'tasks' && parts.length === 1 && req.method === 'GET') {
          sendJson(res, 200, {
            tasks: store.listTasks({
              ownerBotId: url.searchParams.get('owner') ?? undefined,
              roomId: url.searchParams.get('room') ?? undefined,
              status: url.searchParams.get('status') ?? undefined,
            }),
          })
          return
        }
        if (parts[0] === 'tasks' && parts.length === 1 && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await store.createTask({
            title: body.title,
            brief: body.brief,
            ownerBotId: body.owner_bot_id,
            roomId: body.room_id,
            teamId: body.team_id,
            parentId: body.parent_id,
            createdBy: 'human',
          }))
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === undefined && req.method === 'GET') {
          sendJson(res, 200, store.getTask(parts[1]))
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === undefined && req.method === 'PATCH') {
          const body = await readJson(req)
          const task = await store.updateTask(parts[1], {
            status: body.status,
            progress: body.progress,
            ownerBotId: body.owner_bot_id,
            roomId: body.room_id,
            currentStep: body.current_step,
          })
          if (['done', 'failed', 'blocked'].includes(task.status) && task.ownerBotId !== '') {
            await store.setPresence(task.ownerBotId, {
              status: task.status === 'blocked' ? 'blocked' : 'idle',
              taskId: task.status === 'blocked' ? task.id : '',
              action: body.current_step ?? task.status,
            })
          }
          sendJson(res, 200, task)
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === undefined && req.method === 'DELETE') {
          sendJson(res, 200, await store.deleteTask(parts[1]))
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === 'handoff' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await handoffTask(store, runtime, {
            taskId: parts[1],
            fromBotId: body.bot_id,
            toBotId: body.to_bot_id,
            note: body.note,
          }))
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === 'assign' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await assignTask(store, runtime, {
            taskId: parts[1],
            botId: body.bot_id,
            instruction: body.instruction,
          }))
          return
        }
        if (parts[0] === 'tasks' && parts[1] !== undefined && parts[2] === 'report' && req.method === 'POST') {
          const body = await readJson(req)
          const status = body.status
          const task = await store.updateTask(parts[1], {
            status,
            progress: status === 'done' ? 100 : body.progress,
            currentStep: body.message,
          })
          await store.recordActivity({
            botId: body.bot_id ?? task.ownerBotId,
            taskId: task.id,
            kind: 'report',
            label: status === 'blocked' ? '阻塞上报' : '进度上报',
            detail: body.message,
            status: status === 'blocked' ? 'error' : 'done',
          })
          sendJson(res, 200, store.getTask(task.id))
          return
        }
        if (parts[0] === 'activity' && req.method === 'GET') {
          sendJson(res, 200, {
            activity: store.listActivity({
              botId: url.searchParams.get('bot') ?? undefined,
              taskId: url.searchParams.get('task') ?? undefined,
              limit: Number(url.searchParams.get('limit') ?? 100),
            }),
          })
          return
        }
        if (parts[0] === 'bots' && parts[1] !== undefined && req.method === 'DELETE') {
          sendJson(res, 200, await store.deleteBot(parts[1]))
          return
        }
        if (parts[0] === 'templates' && req.method === 'GET') {
          sendJson(res, 200, { templates: listTemplates() })
          return
        }
        if (parts[0] === 'compose' && req.method === 'POST') {
          const body = await readJson(req)
          const brief = typeof body.brief === 'string' ? body.brief.trim() : ''
          if (brief === '') {
            sendJson(res, 400, { error: 'brief is required' })
            return
          }
          sendJson(res, 200, await composeTeam(store, {
            brief,
            templateId: typeof body.template === 'string' ? body.template : undefined,
            name: typeof body.name === 'string' ? body.name : undefined,
          }, runtime))
          return
        }
        if (parts[0] === 'client' && req.method === 'GET') {
          const modules = ctx.get('clientModules')
          let graph
          try {
            graph = typeof modules?.graph === 'function' ? modules.graph() : undefined
          } catch {
            graph = undefined
          }
          const list = Array.isArray(graph?.entries)
            ? graph.entries
            : Array.isArray(graph?.plugins)
              ? graph.plugins
              : []
          sendJson(res, 200, {
            id: 'dsh-team-bot',
            requested: url.searchParams.get('id') ?? 'dsh-team-bot',
            available: modules !== undefined,
            path: typeof modules?.clientPath === 'function'
              ? (modules.clientPath(url.searchParams.get('id') ?? 'dsh-team-bot') ?? null)
              : null,
            ids: list.map((entry) => entry?.id ?? entry?.name ?? '?').slice(0, 100),
          })
          return
        }
        if (parts[0] === 'teams' && parts[1] !== undefined && parts.length === 2 && req.method === 'PATCH') {
          const body = await readJson(req)
          sendJson(res, 200, await store.renameTeam(parts[1], typeof body.name === 'string' ? body.name : ''))
          return
        }
        if (parts[0] === 'teams' && parts[1] !== undefined && parts[2] === 'memory') {
          const teamId = parts[1]
          if (req.method === 'GET') {
            sendJson(res, 200, { team: await store.teamMemory(teamId) })
            return
          }
          if (req.method === 'POST' && parts[3] === 'review') {
            const body = await readJson(req)
            const atomId = typeof body.atom_id === 'string' ? body.atom_id : ''
            const action = body.action
            if (atomId === '' || (action !== 'accept' && action !== 'reject' && action !== 'pending')) {
              sendJson(res, 400, { error: 'atom_id and a valid action are required' })
              return
            }
            const review = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'pending'
            sendJson(res, 200, { memory: await store.reviewTeam(teamId, atomId, review) })
            return
          }
          if (req.method === 'POST') {
            const body = await readJson(req)
            const atom = createAtom({
              text: typeof body.text === 'string' ? body.text : '',
              key: typeof body.key === 'string' ? body.key : undefined,
              importance: typeof body.importance === 'number' ? body.importance : undefined,
              source: 'api',
            })
            sendJson(res, 200, await store.rememberTeam(teamId, atom))
            return
          }
          if (req.method === 'DELETE') {
            const atomId = url.searchParams.get('atom') ?? ''
            if (atomId === '') {
              sendJson(res, 400, { error: 'atom is required' })
              return
            }
            sendJson(res, 200, { memory: await store.forgetTeam(teamId, atomId) })
            return
          }
        }
        if (parts[0] === 'teams' && parts[1] !== undefined && parts.length === 2 && req.method === 'DELETE') {
          sendJson(res, 200, await store.deleteTeam(parts[1]))
          return
        }
        if (parts[0] === 'rooms' && parts[1] !== undefined && parts[2] === undefined && req.method === 'DELETE') {
          sendJson(res, 200, await store.deleteRoom(parts[1]))
          return
        }
        if (parts[0] === 'rooms' && parts[1] !== undefined && parts[2] === undefined && req.method === 'PATCH') {
          const body = await readJson(req)
          const room = await store.updateRoom(parts[1], {
            ...(Array.isArray(body.members) ? { members: body.members.map(String) } : {}),
            ...(typeof body.chief_id === 'string' ? { chiefId: body.chief_id } : {}),
          })
          sendJson(res, 200, room)
          return
        }
        if (parts[0] === 'rooms' && parts.length === 1 && req.method === 'POST') {
          const body = await readJson(req)
          const room = await store.createRoom({
            name: typeof body.name === 'string' ? body.name : '',
            members: Array.isArray(body.members) ? body.members.map(String) : [],
            policy: { replyMode: body.reply_mode },
          })
          sendJson(res, 200, room)
          return
        }
        if (parts[0] === 'dms') {
          if (parts.length === 1 && req.method === 'GET') {
            await store.init()
            sendJson(res, 200, { directs: store.listDirects() })
            return
          }
          const botId = parts[1]
          if (botId !== undefined && parts[2] === 'messages' && req.method === 'GET') {
            const limit = Number(url.searchParams.get('limit') ?? 50)
            sendJson(res, 200, { messages: await store.directHistory(botId, limit) })
            return
          }
          if (botId !== undefined && parts[2] === 'ask' && req.method === 'POST') {
            const body = await readJson(req)
            const text = typeof body.text === 'string' ? body.text : ''
            if (text.trim() === '') {
              sendJson(res, 400, { error: 'text is required' })
              return
            }
            const result = await askDirect(store, runtime, { botId, text }, AbortSignal.timeout(300_000))
            sendJson(res, 200, result)
            return
          }
        }
        if (parts[0] !== 'rooms' || parts[1] === undefined) {
          sendJson(res, 404, { error: 'not found' })
          return
        }
        const roomId = decodeURIComponent(parts[1])
        if (parts[2] === 'messages' && req.method === 'GET') {
          const limit = Number(url.searchParams.get('limit') ?? 50)
          sendJson(res, 200, { messages: await store.history(roomId, limit) })
          return
        }
        if (parts[2] === 'memory' && req.method === 'GET') {
          const botId = url.searchParams.get('bot') ?? ''
          const room = await store.roomMemory(roomId)
          const bot = botId === '' ? undefined : await store.botMemory(botId)
          sendJson(res, 200, bot === undefined ? { room } : { room, bot })
          return
        }
        if (parts[2] === 'memory' && parts[3] === 'review' && req.method === 'POST') {
          const body = await readJson(req)
          const atomId = typeof body.atom_id === 'string' ? body.atom_id : ''
          const action = body.action
          if (atomId === '' || (action !== 'accept' && action !== 'reject' && action !== 'pending')) {
            sendJson(res, 400, { error: 'atom_id and a valid action are required' })
            return
          }
          const review = action === 'accept' ? 'accepted' : action === 'reject' ? 'rejected' : 'pending'
          if (body.scope === 'bot') {
            if (typeof body.bot_id !== 'string' || body.bot_id === '') {
              sendJson(res, 400, { error: 'bot_id is required when scope=bot' })
              return
            }
            sendJson(res, 200, { memory: await store.reviewBot(body.bot_id, atomId, review) })
            return
          }
          sendJson(res, 200, { memory: await store.reviewRoom(roomId, atomId, review) })
          return
        }
        if (parts[2] === 'memory' && req.method === 'POST') {
          const body = await readJson(req)
          const atom = createAtom({
            text: typeof body.text === 'string' ? body.text : '',
            key: typeof body.key === 'string' ? body.key : undefined,
            importance: typeof body.importance === 'number' ? body.importance : undefined,
            source: 'api',
          })
          if (body.scope === 'bot') {
            if (typeof body.bot_id !== 'string' || body.bot_id === '') {
              sendJson(res, 400, { error: 'bot_id is required when scope=bot' })
              return
            }
            sendJson(res, 200, await store.rememberBot(body.bot_id, atom))
            return
          }
          sendJson(res, 200, await store.rememberRoom(roomId, atom))
          return
        }
        if (parts[2] === 'memory' && req.method === 'DELETE') {
          const atomId = url.searchParams.get('atom') ?? ''
          if (atomId === '') {
            sendJson(res, 400, { error: 'atom is required' })
            return
          }
          const scope = url.searchParams.get('scope') ?? 'room'
          if (scope === 'bot') {
            const botId = url.searchParams.get('bot') ?? ''
            if (botId === '') {
              sendJson(res, 400, { error: 'bot is required when scope=bot' })
              return
            }
            sendJson(res, 200, { memory: await store.forgetBot(botId, atomId) })
            return
          }
          sendJson(res, 200, { memory: await store.forgetRoom(roomId, atomId) })
          return
        }
        if (parts[2] === 'ask' && req.method === 'POST') {
          const body = await readJson(req)
          const text = typeof body.text === 'string' ? body.text : ''
          if (text.trim() === '') {
            sendJson(res, 400, { error: 'text is required' })
            return
          }
          const mentions = Array.isArray(body.mentions) ? body.mentions.map(String) : []
          const result = await askRoom(store, runtime, { roomId, text, mentions }, AbortSignal.timeout(300_000))
          sendJson(res, 200, result)
          return
        }
        sendJson(res, 404, { error: 'not found' })
      } catch (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  })
}
