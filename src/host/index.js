/**
 * dsh-team-bot P0 Host plugin.
 *
 * Registers the room store and its model-facing tools. P1 adds the real-Session
 * runtime, P2 the Web panel, and P3 the L0-L3 memory workers.
 */
import os from 'node:os'
import path from 'node:path'
import { mkdirSync } from 'node:fs'
import z from '@deepseek-ai/schemastery'
import { TeamStore } from './store.js'
import { BotRuntime } from './runtime.js'
import { createTools } from './tools.js'
import { registerRoutes } from './routes.js'
import { startWatchdog } from './watchdog.js'

export const name = 'team-bot'
export const inject = ['tools', 'sessionController', 'webServer']

export const Config = z.object({
  dataDir: z.string().default(''),
  workspaceRoot: z.string().default(''),
})

/**
 * Mount the P0 store and tools.
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ dataDir?: string }} config
 */
export function apply(ctx, config = {}) {
  const home = process.env.DSH_HOME ?? path.join(os.homedir(), '.dsh')
  const dataDir = typeof config.dataDir === 'string' && config.dataDir.trim() !== ''
    ? config.dataDir
    : path.join(home, 'dsh-team-bot')
  const workspaceRoot = typeof config.workspaceRoot === 'string' && config.workspaceRoot.trim() !== ''
    ? config.workspaceRoot
    : path.join(dataDir, 'workspace')
  mkdirSync(workspaceRoot, { recursive: true })
  const store = new TeamStore(dataDir)
  const runtime = new BotRuntime(ctx, store, { workspaceRoot })
  const disposers = []
  for (const definition of createTools(store, runtime)) disposers.push(ctx.tools.register(definition))
  disposers.push(registerRoutes(ctx, store, runtime))
  disposers.push(startWatchdog(store, runtime))
  ctx.effect(() => () => {
    for (const dispose of disposers.reverse()) dispose()
  }, 'team-bot.tools()')
}
