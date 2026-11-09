import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { TeamStore } from '../src/host/store.js'
import { composeTeam } from '../src/host/compose.js'
import { createAvatar } from '../src/host/avatars.js'
import { matchTemplate } from '../src/host/templates.js'

test('avatar descriptors are deterministic', () => {
  assert.deepEqual(createAvatar('总导演'), createAvatar('总导演'))
  assert.notDeepEqual(createAvatar('总导演'), createAvatar('剪辑师'))
})

test('matchTemplate maps a short-video brief to its archetype', () => {
  assert.equal(matchTemplate('我要做一个短视频团队')?.id, 'short-video')
  assert.equal(matchTemplate('帮我开发一个 App')?.id, 'software')
  assert.equal(matchTemplate('随便聊聊') === undefined, true)
})

test('composeTeam creates bots, a main room, and sub-rooms with chiefs', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-compose-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const result = await composeTeam(store, { brief: '我要做一个短视频团队', templateId: 'short-video' })
    assert.equal(result.teamName, '短视频团队')
    assert.equal(result.bots.length, 8)
    assert.equal(result.rooms.length, 3)
    const main = result.rooms[0]
    assert.equal(main.members.length, 8)
    assert.equal(store.getBot(main.chiefId).name, '总导演')
    const pre = result.rooms.find((room) => room.name === '前期组')
    assert.equal(store.getBot(pre.chiefId).name, '前期导演')
    const post = result.rooms.find((room) => room.name === '后期组')
    assert.equal(store.getBot(post.chiefId).name, '后期导演')
    assert.ok(result.bots.every((bot) => bot.teamId === result.teamId && bot.avatar !== undefined))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('composeTeam falls back to a small generic team and keeps room names unique', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-compose-fallback-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const first = await composeTeam(store, { brief: '帮我组一个团队' })
    assert.equal(first.bots.length, 3)
    assert.equal(first.rooms.length, 1)
    const second = await composeTeam(store, { brief: '帮我组一个团队' })
    assert.equal(second.rooms[0].name.endsWith(' 2'), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an arbitrary brief goes through the hidden architect', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-architect-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const fake = {
      async ask() {
        return '```json\n' + JSON.stringify({
          team: '宠物告别团队',
          chief: '店长',
          roles: [
            { name: '店长', role: '接待与流程', persona: '负责家属沟通和仪式流程。' },
            { name: '礼仪师', role: '仪式执行', persona: '执行告别仪式，注意情绪与细节。' },
            { name: '纪念品设计', role: '纪念品', persona: '设计爪印、相册等纪念物。' },
          ],
          rooms: [{ name: '接待组', members: ['店长', '礼仪师'], chief: '店长' }],
        }) + '\n```'
      },
    }
    const result = await composeTeam(store, { brief: '我想做宠物殡葬' }, fake)
    assert.equal(result.teamName, '宠物告别团队')
    assert.equal(result.bots.length, 3)
    assert.equal(result.rooms.length, 2)
    assert.equal(store.listBots().some((bot) => bot.hidden), false)
    assert.equal(store.listBots({ includeHidden: true }).some((bot) => bot.hidden), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an invalid architect plan falls back to the generic team', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-team-bot-architect-bad-'))
  try {
    const store = new TeamStore(dir)
    await store.init()
    const result = await composeTeam(store, { brief: '未知领域' }, { async ask() { return 'sorry' } })
    assert.equal(result.bots.length, 3)
    assert.equal(result.rooms.length, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
