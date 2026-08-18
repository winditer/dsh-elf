import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

test('mounts the ordinary Host plugin without a dynamic harness global', () => {
  delete globalThis.harness
  const routes = []
  const webServer = { register(route) { routes.push(route); return () => {} } }
  const ctx = {
    get(name) {
      if (name === 'llm') return { stream: async function* () {} }
      if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'test', model: 'test' }) }
      return undefined
    },
    effect(callback) { callback() },
    inject(services, callback) {
      assert.deepEqual(services, ['webServer'])
      callback({ webServer, effect: this.effect })
    },
  }

  assert.doesNotThrow(() => apply(ctx))
  assert.equal(routes.length, 1)
  assert.equal(routes[0].kind, 'prefix')
  assert.equal(routes[0].path, '/dsh-elf/api')
})
