/**
 * Room actions shared by the model tool and the Web API.
 */
import { buildDirectPrompt, buildRoomPrompt, buildTaskPrompt } from './runtime.js'
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
  if (room.teamId !== '') {
    try {
      const teamRooms = store.listRooms().filter((item) => item.teamId === room.teamId)
      const histories = await Promise.all(teamRooms.map((item) => store.history(item.id, 4)))
      const merged = histories
        .flat()
        .sort((left, right) => String(left.ts).localeCompare(String(right.ts)))
      await store.setTeamSummary(room.teamId, buildSummary(merged.slice(-8)))
    } catch {
      // The team may have been deleted while the replies were running.
    }
  }
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

/**
 * Transfer a task to another bot and wake the target asynchronously. The caller
 * returns immediately; the target's turn and task steps are recorded by the
 * normal runtime path.
 */
export async function handoffTask(store, runtime, input) {
  await store.init()
  const task = store.getTask(input.taskId)
  const from = store.getBot(input.fromBotId)
  const to = store.getBot(input.toBotId)
  if (task.ownerBotId !== '' && task.ownerBotId !== from.id && from.isMain !== true) {
    throw new Error('only the current task owner or the Main Bot can hand off this task')
  }
  if (to.id === from.id) throw new Error('cannot hand a task to its current owner')
  await store.updateTask(task.id, {
    ownerBotId: to.id,
    status: 'queued',
    currentStep: `交接给 ${to.name}`,
  })
  await store.addTaskStep(task.id, {
    kind: 'handoff',
    label: `交接给 ${to.name}`,
    detail: String(input.note ?? ''),
    status: 'done',
  })
  await store.setPresence(from.id, { status: 'idle', taskId: '', action: '已交接' })
  await store.recordActivity({
    botId: from.id,
    taskId: task.id,
    kind: 'handoff',
    label: `交给 ${to.name}`,
    detail: String(input.note ?? ''),
    status: 'done',
  })
  void assignTask(store, runtime, {
    taskId: task.id,
    botId: to.id,
    instruction: input.note,
  }).catch(async (error) => {
    await store.recordActivity({
      botId: to.id,
      taskId: task.id,
      kind: 'error',
      label: '交接执行失败',
      detail: error instanceof Error ? error.message : String(error),
      status: 'error',
    }).catch(() => undefined)
  })
  return { task: store.getTask(task.id), queued: true, target: to.id }
}

/**
 * Run one durable task on one bot. The task ledger is updated before and after
 * the Session turn, and the runtime taps tool/step events while it runs.
 */
export async function assignTask(store, runtime, input, signal) {
  await store.init()
  const task = store.getTask(input.taskId)
  const bot = store.getBot(input.botId)
  const room = task.roomId === '' ? undefined : store.getRoom(task.roomId)
  await store.updateTask(task.id, {
    ownerBotId: bot.id,
    status: 'running',
    currentStep: '已被主 Bot 派发',
  })
  await store.addTaskStep(task.id, {
    kind: 'handoff',
    label: `派发给 ${bot.name}`,
    detail: input.instruction ?? task.brief,
    status: 'done',
  })
  await store.setPresence(bot.id, { status: 'thinking', taskId: task.id, action: '接收任务' })
  const botMemory = await store.botMemory(bot.id)
  const roomMemory = room === undefined ? undefined : await store.roomMemory(room.id)
  const teamMemory = task.teamId === '' ? undefined : await store.teamMemory(task.teamId)
  let replyText = ''
  try {
    const prompt = buildTaskPrompt(bot, task, room, { roomMemory, botMemory, teamMemory, query: task.brief || task.title })
    replyText = (await runtime.ask(bot, prompt, signal, { taskId: task.id, roomId: task.roomId })).trim()
    if (replyText !== '' && replyText !== '[PASS]') {
      if (room !== undefined) {
        await store.postMessage({
          roomId: room.id,
          sender: { type: 'bot', id: bot.id, name: bot.name },
          text: replyText,
        })
      } else {
        await store.postDirect({
          botId: bot.id,
          sender: { type: 'bot', id: bot.id, name: bot.name },
          text: replyText,
        })
      }
    }
    const latest = store.getTask(task.id)
    if (!['done', 'failed', 'blocked'].includes(latest.status)) {
      await store.updateTask(task.id, { status: 'waiting', currentStep: '本轮结束，等待验收' })
    }
    await store.setPresence(bot.id, { status: 'idle', taskId: '', action: '空闲' })
    return { task: store.getTask(task.id), reply: replyText }
  } catch (error) {
    await store.updateTask(task.id, {
      status: 'failed',
      currentStep: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined)
    await store.setPresence(bot.id, {
      status: 'blocked',
      taskId: task.id,
      action: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined)
    throw error
  }
}
