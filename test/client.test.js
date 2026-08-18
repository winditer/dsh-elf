import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const client = readFileSync(resolve(ROOT, 'src/client.js'), 'utf8')

test('client half uses plain browser timers, not the bundle-unavailable cordis timer service', () => {
  // The `timer` service is only installed for dynamic cordis-runner packages; a
  // profile-bundle client like dsh-elf gets ctx.get('timer') === undefined, which
  // silently killed both the orb drift and the chat poll loop. Regression guard.
  assert.doesNotMatch(client, /ctx\.get\('timer'\)/, 'must not depend on the cordis timer service')
  assert.match(client, /window\.setInterval\(/, 'drift/chat timers must use plain browser setInterval')
  assert.match(client, /window\.setTimeout\(pollOnce, 0\)/, 'chat poll must kick off with a browser timeout')
  assert.match(client, /window\.clearInterval\(/, 'timers must be disposed on effect cleanup')
  assert.match(client, /window\.clearTimeout\(first\)/, 'poll first-fire timeout must be cleared')
})

test('client half styles the "follow session default" checkbox explicitly', () => {
  // `.dsh-elf-configrow input { flex:1; min-width:0; }` used to also match the
  // checkbox, squeezing it to zero width so the toggle was invisible. Regression guard.
  assert.match(client, /input\[type='checkbox'\]/, 'checkbox needs its own explicit rule')
  assert.match(client, /min-width: 14px/, 'checkbox must not shrink below 14px')
  assert.match(client, /\.dsh-elf-configrow label\.dsh-elf-check \{ width: auto/, 'follow label must not inherit the 84px column width')
  assert.match(client, /input\[type='text'\], \.dsh-elf-configrow input\[type='password'\]/, 'generic input styling must exclude the checkbox')
})