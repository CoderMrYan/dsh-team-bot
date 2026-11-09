/**
 * LLM team architect.
 *
 * When the brief does not match a built-in template, a hidden "团队架构师" bot
 * turns the sentence into a validated JSON plan. The plan then goes through the
 * same composeTeam path as a template, so ids, avatars and chiefs behave the
 * same. If the model returns junk, composeTeam falls back to the generic team.
 */

const ARCHITECT_ROLE = '团队架构'
const ARCHITECT_NAME = '团队架构师'
const SCHEMA_HINT = `只输出 JSON，不要 markdown，不要解释：
{
  "team": "团队名",
  "summary": "一句话说明",
  "chief": "总管角色名",
  "roles": [
    { "name": "角色名", "role": "一句话职责", "persona": "给这个 Bot 的常驻工作方式，1-2 句" }
  ],
  "rooms": [
    { "name": "分组名", "members": ["角色名"], "chief": "角色名" }
  ]
}
规则：角色 2-10 个；角色名要短；rooms 可以为空；每个 room 的 chief 必须在 members 里。`

/** @returns {object|undefined} a parsed JSON object, tolerating code fences. */
export function parsePlan(text) {
  const raw = String(text ?? '').trim()
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = fenced === null ? raw : fenced[1]
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return undefined
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return undefined
  }
}

/** @returns {object|undefined} a normalized plan, or undefined when invalid. */
export function normalizePlan(value) {
  if (value === null || typeof value !== 'object') return undefined
  const team = String(value.team ?? '').trim()
  const roles = Array.isArray(value.roles)
    ? value.roles
        .map((role) => ({
          name: String(role?.name ?? '').trim(),
          role: String(role?.role ?? role?.name ?? '').trim(),
          persona: String(role?.persona ?? '').trim(),
        }))
        .filter((role) => role.name !== '')
    : []
  if (team === '' || roles.length < 2 || roles.length > 10) return undefined
  const names = new Set(roles.map((role) => role.name))
  const chief = String(value.chief ?? '').trim()
  const rooms = Array.isArray(value.rooms)
    ? value.rooms
        .map((room) => ({
          name: String(room?.name ?? '').trim(),
          members: (room?.members ?? []).map(String).filter((name) => names.has(name)),
          chief: String(room?.chief ?? '').trim(),
        }))
        .filter((room) => room.name !== '' && room.members.length > 0)
    : []
  return {
    team,
    summary: String(value.summary ?? '').trim(),
    chief: names.has(chief) ? chief : roles[0].name,
    roles,
    rooms,
  }
}

/** @returns {Promise<object|undefined>} the architect's validated plan. */
export async function designTeam(store, runtime, brief) {
  let architect = store.listBots({ includeHidden: true }).find((bot) => bot.hidden && bot.role === ARCHITECT_ROLE)
  if (architect === undefined) {
    architect = await store.createBot({
      name: ARCHITECT_NAME,
      role: ARCHITECT_ROLE,
      persona: '你是团队架构师：把一句业务目标拆成可执行的角色和分组。你的输出只用于程序解析。',
      hidden: true,
    })
  }
  const prompt = `用户想做：${brief}\n\n请为这个目标设计一个团队。${SCHEMA_HINT}`
  const text = await runtime.ask(architect, prompt)
  return normalizePlan(parsePlan(text))
}
