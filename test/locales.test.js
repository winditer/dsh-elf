import test from 'node:test'
import assert from 'node:assert/strict'
import { en, zh, NS } from '../src/locales.js'

test('namespace is "dsh-elf"', () => {
  assert.equal(NS, 'dsh-elf')
})

test('en mirrors zh key-for-key (1:1 dictionary)', () => {
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.deepEqual(enKeys, zhKeys)
})

test('core keys exist with both languages', () => {
  for (const k of ['name', 'title', 'follow', 'modelSource', 'empty', 'inputPh', 'hostFail', 'needCustomCfg']) {
    assert.ok(zh[k] && zh[k].length, `zh.${k} missing`)
    assert.ok(en[k] && en[k].length, `en.${k} missing`)
  }
  assert.ok(zh.hostFail.includes('{0}'), 'hostFail needs a {0} placeholder')
  assert.ok(en.hostFail.includes('{0}'))
})