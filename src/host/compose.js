/**
 * One-sentence team composition: pick a template (or explicit roles), create
 * the bots, then create a main room plus optional sub-rooms with their own
 * chiefs. The Store owns ids, avatars and persistence; this module owns the
 * plan-to-records mapping.
 */
import { randomUUID } from 'node:crypto'
import { getTemplate, matchTemplate } from './templates.js'

const FALLBACK_ROLES = [
  { name: '负责人', role: '负责人', persona: '拆解目标、分配任务、检查交付；不替成员做细节。' },
  { name: '执行', role: '执行', persona: '按负责人的拆解推进具体工作，交付可检查的结果。' },
  { name: '审校', role: '审校', persona: '检查事实、完成度和风险，逐条给修改意见。' },
]

/** @returns {string} a room name that is not taken yet. */
function uniqueRoomName(store, base) {
  const names = new Set(store.listRooms().map((room) => room.name))
  if (!names.has(base)) return base
  for (let index = 2; ; index += 1) {
    const candidate = `${base} ${index}`
    if (!names.has(candidate)) return candidate
  }
}

/**
 * @param {object} store - TeamStore.
 * @param {{brief?:string, templateId?:string, name?:string, roles?:object[], chief?:string, rooms?:object[]}} input
 * @returns {Promise<{teamId:string, teamName:string, brief:string, bots:object[], rooms:object[]}>}
 */
export async function composeTeam(store, input = {}) {
  await store.init()
  const brief = String(input.brief ?? '').trim()
  const template = input.templateId !== undefined ? getTemplate(input.templateId) : matchTemplate(brief)
  const roleSpecs = Array.isArray(input.roles) && input.roles.length > 0
    ? input.roles
    : (template?.roles ?? FALLBACK_ROLES)
  const fallbackName = brief === '' ? '自定义团队' : `${brief.slice(0, 16)}团队`
  const teamName = String(input.name ?? template?.name ?? fallbackName).trim() || '自定义团队'
  const teamId = `team-${randomUUID().slice(0, 8)}`

  const bots = []
  const byRole = new Map()
  for (const spec of roleSpecs) {
    const name = String(spec.name ?? '').trim()
    if (name === '') continue
    const bot = await store.createBot({
      name,
      role: String(spec.role ?? name),
      persona: String(spec.persona ?? ''),
      teamId,
    })
    bots.push(bot)
    byRole.set(name, bot)
  }
  if (bots.length === 0) throw new Error('team needs at least one role')

  const chiefName = String(input.chief ?? template?.chief ?? roleSpecs[0]?.name ?? '')
  const chief = byRole.get(chiefName) ?? bots[0]
  const rooms = []
  rooms.push(await store.createRoom({
    name: uniqueRoomName(store, teamName),
    members: bots.map((bot) => bot.id),
    chiefId: chief.id,
    teamId,
    policy: { replyMode: 'auto', maxSpeakers: 3 },
  }))

  const roomSpecs = Array.isArray(input.rooms) ? input.rooms : (template?.rooms ?? [])
  for (const spec of roomSpecs) {
    const members = (spec.members ?? [])
      .map((name) => byRole.get(String(name))?.id)
      .filter((id) => id !== undefined)
    if (members.length === 0) continue
    const desiredChief = byRole.get(String(spec.chief ?? ''))?.id
    const chiefId = desiredChief !== undefined && members.includes(desiredChief) ? desiredChief : members[0]
    rooms.push(await store.createRoom({
      name: uniqueRoomName(store, String(spec.name ?? `${teamName}·分组`)),
      members,
      chiefId,
      teamId,
      policy: { replyMode: 'auto', maxSpeakers: 2 },
    }))
  }

  return { teamId, teamName, brief, bots, rooms }
}
