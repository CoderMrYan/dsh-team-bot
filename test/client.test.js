import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

test('client bundle registers one settings.section page', () => {
  let row
  const window = { __ModuleLoader__: { load: (value) => { row = value } } }
  const React = {
    createElement: () => null,
    Fragment: 'fragment',
    useCallback: (fn) => fn,
    useEffect: () => undefined,
    useState: (value) => [value, () => undefined],
  }
  const require = (id) => {
    if (id === 'react') return React
    throw new Error(`unexpected client import: ${id}`)
  }
  vm.runInNewContext(source, {
    window,
    require,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    setInterval: () => 0,
    clearInterval: () => undefined,
    console,
  })
  assert.equal(row.id, 'dsh-team-bot')
  const module = row.factory(require)
  const registered = []
  const ctx = {
    slots: {
      inject: (name, register) => { registered.push({ injected: name }); register() },
      register: (options, Component) => { registered.push({ options, Component }); return () => undefined },
    },
  }
  module.apply(ctx)
  assert.equal(registered[0].injected, 'settings.section')
  const page = registered.find((entry) => entry.options !== undefined)
  assert.equal(page.options.name, 'settings.section')
  assert.equal(page.options.id, 'team-bot')
  assert.equal(page.options.label, '团队群组')
  assert.equal(typeof page.Component, 'function')
})
