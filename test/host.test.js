import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

// Mount the host plugin and return the registered webServer route handler for
// /dsh-elf/api. Everything else is faked: llm.stream supplies the chunk
// sequence the test wants, agentDefaultModel a fixed selection.
function mount(opts = {}) {
  const routes = []
  const llmStream = opts.llmStream || (async function* () {})
  const selection = { provider: 'test-provider', model: 'test-model', reasoningEffort: 'medium' }
  const ctx = {
    get(name) {
      if (name === 'llm') return { stream: llmStream }
      if (name === 'agentDefaultModel') return { currentSelection: () => selection }
      return undefined
    },
    effect(callback) { callback() },
    inject(services, callback) {
      assert.deepEqual(services, ['webServer'])
      callback({ webServer: { register(route) { routes.push(route); return () => {} } }, effect: this.effect })
    },
  }
  apply(ctx)
  return routes[0].handler
}

// Plain-object fake IncomingMessage: async-iterable so readJsonBody's
// `for await (const chunk of req)` works, exactly like the real req.
function makeReq({ method = 'POST', url = '/dsh-elf/api/elf.sessionModel', json = null, raw = null }) {
  let sent = false
  const payload = raw !== null ? raw : json !== null ? JSON.stringify(json) : ''
  const req = { method, url }
  req[Symbol.asyncIterator] = async function* () {
    if (sent) return
    sent = true
    if (payload) yield payload
  }
  return req
}

function makeRes() {
  const res = { status: null, headers: null, body: null }
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers }
  res.end = (body) => { res.body = body }
  return res
}

async function call(handler, req) {
  const res = makeRes()
  await handler(req, res)
  return res
}

const parse = (res) => JSON.parse(res.body)

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

test('only POST is accepted — anything else gets 405', async () => {
  const handler = mount()
  for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
    const res = await call(handler, makeReq({ method, url: '/dsh-elf/api/elf.sessionModel' }))
    assert.equal(res.status, 405, `${method} must be rejected with 405`)
    assert.deepEqual(parse(res), { ok: false, error: '只支持 POST' })
  }
})

test('unknown or nested methods return 404', async () => {
  const handler = mount()
  const res = await call(handler, makeReq({ url: '/dsh-elf/api/elf.doesNotExist' }))
  assert.equal(res.status, 404)
  assert.equal(parse(res).ok, false)
  const nested = await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat/start' }))
  assert.equal(nested.status, 404)
  assert.equal(parse(nested).ok, false)
})

test('a non-JSON body is rejected with 400', async () => {
  const handler = mount()
  const res = await call(handler, makeReq({ url: '/dsh-elf/api/elf.sessionModel', raw: 'not json{' }))
  assert.equal(res.status, 400)
  assert.equal(parse(res).ok, false)
})

test('an oversized body is rejected with 413', async () => {
  const handler = mount()
  const big = JSON.stringify({ messages: [{ role: 'user', text: 'x'.repeat(1 << 20) }] })
  const res = await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.start', raw: big }))
  assert.equal(res.status, 413)
  assert.equal(parse(res).ok, false)
})

test('elf.sessionModel reports the session default model and effort', async () => {
  const handler = mount()
  const res = await call(handler, makeReq({ url: '/dsh-elf/api/elf.sessionModel' }))
  assert.equal(res.status, 200)
  assert.deepEqual(parse(res), {
    ok: true,
    value: { available: true, provider: 'test-provider', model: 'test-model', reasoningEffort: 'medium' },
  })
})

test('elf.chat.start with no messages is refused', async () => {
  const handler = mount()
  const res = await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.start', json: { messages: [] } }))
  assert.equal(res.status, 200)
  assert.deepEqual(parse(res).value, { ok: false, error: '没有消息内容' })
})

test('chat lifecycle: start streams deltas, poll accumulates, close frees the entry', async () => {
  const handler = mount({
    llmStream: async function* () {
      yield { type: 'text-delta', text: '你' }
      yield { type: 'text-delta', text: '好' }
      yield { type: 'finish', reason: { kind: 'done' } }
    },
  })

  const started = await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.start', json: { messages: [{ role: 'user', text: '嗨' }] } }))
  assert.equal(started.status, 200)
  const { ok, chatId } = parse(started).value
  assert.equal(ok, true)
  assert.ok(chatId && chatId.startsWith('elf-chat-'))

  let r = null
  for (let i = 0; i < 50; i++) {
    r = parse(await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.poll', json: { chatId } }))).value
    if (r.done) break
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(r.done, true, 'stream must reach the finish chunk')
  assert.equal(r.text, '你好')
  assert.equal(r.error, null)

  const closed = await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.close', json: { chatId } }))
  assert.deepEqual(parse(closed), { ok: true, value: { ok: true } })

  // Polling a closed chat is reported as ended, not an error.
  const after = parse(await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.poll', json: { chatId } }))).value
  assert.equal(after.done, true)
  assert.equal(after.ok, false)
})

test('a stream that throws surfaces the error on poll and still ends', async () => {
  const handler = mount({
    llmStream: async function* () {
      yield { type: 'text-delta', text: '前' }
      throw new Error('provider exploded')
    },
  })
  const { chatId } = parse(await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.start', json: { messages: [{ role: 'user', text: 'x' }] } }))).value
  let r = null
  for (let i = 0; i < 50; i++) {
    r = parse(await call(handler, makeReq({ url: '/dsh-elf/api/elf.chat.poll', json: { chatId } }))).value
    if (r.done) break
    await new Promise((resolve) => setImmediate(resolve))
  }
  assert.equal(r.done, true)
  assert.match(r.error, /provider exploded/)
})