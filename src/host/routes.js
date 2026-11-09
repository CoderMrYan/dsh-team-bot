/**
 * Browser HTTP surface for the P2 panel.
 *
 * Routes live under `/dsh-team-bot/api` and are same-origin only. They read the
 * same store and runtime the model tools use, so the panel and the agent never
 * diverge.
 */
import { askRoom } from './actions.js'
import { createAtom } from './memory.js'

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
        if (parts[0] === 'health') {
          sendJson(res, 200, { ok: true })
          return
        }
        if (parts[0] === 'state' && req.method === 'GET') {
          await store.init()
          sendJson(res, 200, { bots: store.listBots(), rooms: store.listRooms() })
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
