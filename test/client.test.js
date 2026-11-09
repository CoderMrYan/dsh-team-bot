import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

test('client bundle registers sidebar, main, and settings entries', () => {
  let row
  const window = { __ModuleLoader__: { load: (value) => { row = value } } }
  const React = {
    createElement: () => null,
    Fragment: 'fragment',
    Component: class Component {
      constructor(props) {
        this.props = props
        this.state = {}
      }
    },
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
  assert.equal(module.inject.length, 1)
  assert.equal(module.inject[0], 'slots')
  const registered = []
  const ctx = {
    slots: {
      inject: (name, register) => { registered.push({ injected: name }); register() },
      register: (options, Component) => { registered.push({ options, Component }); return () => undefined },
    },
  }
  module.apply(ctx)
  const injected = registered.filter((entry) => entry.injected !== undefined).map((entry) => entry.injected)
  assert.deepEqual(injected, ['sidebar.panellist', 'main', 'settings.section'])
  const options = registered.filter((entry) => entry.options !== undefined)
  const sidebar = options.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(sidebar.options.id, 'team-bot')
  assert.equal(sidebar.options.order, 20)
  assert.equal(typeof sidebar.Component, 'function')
  const main = options.find((entry) => entry.options.name === 'main')
  assert.equal(main.options.key, 'team-bot')
  const settings = options.find((entry) => entry.options.name === 'settings.section')
  assert.equal(settings.options.id, 'team-bot')
  assert.equal(settings.options.label, '团队群组')
  assert.equal(typeof settings.Component, 'function')
})
