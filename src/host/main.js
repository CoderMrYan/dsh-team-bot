/**
 * Main Bot command center.
 *
 * The Main Bot is a normal bot profile with `isMain: true` and its own real
 * DSH Session. The command center is a private chat with it; the same Session
 * receives team state, task state and live presence on every command.
 */
import { buildMainPrompt } from './runtime.js'

export const MAIN_PERSONA = `You are the Main Bot of this DSH team. You are a real agent with your own Session, not a settings screen.
Your job is to turn the Lead's intent into concrete team work: create focused sub-bots, create groups, create durable tasks, assign owners, inspect progress, unblock work, and summarize outcomes.
You must use the team_* tools instead of only describing what should happen.
Always keep tasks observable: every delegated task gets a task id, an owner, a status and progress reports.
Never claim a sub-bot did work that is not in the task/activity log.
Destructive actions need explicit confirmation from the Lead.
Reply in Chinese unless the Lead writes in another language. Be concise, operational and honest about blockers.`

/** Ensure the Main Bot exists and carries the command-center persona. */
export async function ensureMain(store) {
  await store.init()
  const main = await store.ensureMainBot({ persona: MAIN_PERSONA })
  if (main.persona === '') {
    main.persona = MAIN_PERSONA
    await store.save()
  }
  return main
}

/** Read the live command-center snapshot used by the prompt and the UI. */
export async function commandState(store) {
  await store.init()
  const main = await ensureMain(store)
  return {
    main,
    bots: store.listBots(),
    rooms: store.listRooms(),
    tasks: store.listTasks(),
    presence: store.listPresence(),
    activity: store.listActivity({ limit: 80 }),
  }
}

/** Append one proactive Main Bot notification to the command-center chat. */
export async function notifyMain(store, text) {
  const main = await ensureMain(store)
  return await store.postDirect({
    botId: main.id,
    sender: { type: 'bot', id: main.id, name: main.name },
    text: String(text ?? ''),
  })
}

/**
 * Send one command to the Main Bot and persist both sides in its private chat.
 * @param {import('./store.js').TeamStore} store
 * @param {import('./runtime.js').BotRuntime} runtime
 * @param {{ text: string }} input
 * @param {AbortSignal} [signal]
 */
export async function askMain(store, runtime, input, signal) {
  const state = await commandState(store)
  const main = state.main
  const posted = await store.postDirect({
    botId: main.id,
    sender: { type: 'human', name: 'human' },
    text: input.text,
  })
  const prompt = buildMainPrompt(main, state.bots, state.rooms, state.tasks, state.presence, input.text)
  const text = (await runtime.ask(main, prompt, signal)).trim()
  if (text === '' || text === '[PASS]') {
    return { main, posted, reply: undefined }
  }
  const reply = await store.postDirect({
    botId: main.id,
    sender: { type: 'bot', id: main.id, name: main.name },
    text,
  })
  return { main, posted, reply }
}
