import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  childPaths,
  childSnapshot,
  diffChildMaps,
  summarizePatch,
  stableString,
} from '../lib/report.mjs'

test('stableString ignores object key order', () => {
  assert.equal(stableString({ a: 1, b: { c: 2, d: 3 } }), stableString({ b: { d: 3, c: 2 }, a: 1 }))
})

test('childPaths suffixes duplicate ids instead of merging them', () => {
  const paths = childPaths([{ id: 'x' }, { id: 'x' }, { name: 'y' }])
  assert.deepEqual(paths.map((entry) => entry.path), ['x', 'x#2', 'y'])
})

test('diffChildMaps reports inserts, patches, and keeps unchanged rows silent', () => {
  const before = childSnapshot([
    { id: 'a', name: 'pkg-a', config: { n: 1 } },
    { id: 'g', name: 'cordis:group', config: [{ id: 'b', name: 'pkg-b' }] },
  ])
  const after = childSnapshot([
    { id: 'a', name: 'pkg-a', config: { n: 2 } },
    { id: 'g', name: 'cordis:group', config: [{ id: 'b', name: 'pkg-b' }, { id: 'c', name: 'pkg-c' }] },
  ])
  const steps = diffChildMaps(before, after)
  assert.deepEqual(steps.map((step) => [step.path, step.action]), [
    ['a', 'patch'],
    ['g/c', 'insert'],
  ])
  assert.deepEqual(steps[0].before.config, { n: 1 })
  assert.deepEqual(steps[0].after.config, { n: 2 })
  assert.deepEqual(diffChildMaps(after, after), [])
})

test('diffChildMaps reports a removed row and suppresses its descendants', () => {
  const before = childSnapshot([
    { id: 'g', name: 'cordis:group', config: [{ id: 'a' }, { id: 'b' }] },
    { id: 'c', name: 'pkg-c' },
  ])
  const after = childSnapshot([{ id: 'c', name: 'pkg-c' }])
  const steps = diffChildMaps(before, after)
  assert.deepEqual(steps.map((step) => [step.path, step.action]), [
    ['g', 'remove'],
  ])
})

test('summarizePatch separates inserts, config patches, and disables', () => {
  const ops = summarizePatch({
    insert: [{ id: 'row-a', name: 'pkg-a', config: { x: 1 } }],
  }).concat(summarizePatch({ id: 'row-b', config: { y: 2 } })).concat(summarizePatch({ id: 'row-c', disabled: true }))
  assert.deepEqual(ops.map((op) => [op.id, op.action]), [
    ['row-a', 'insert'],
    ['row-b', 'replace'],
    ['row-c', 'disable'],
  ])
  assert.deepEqual(ops[1].configKeys, ['y'])
})

test('summarizePatch preserves a !!js condition as text', () => {
  const [op] = summarizePatch({ insert: [{ id: 'x', name: 'pkg', disabled: { __jsExpr: 'ctx.get("profileContext")' } }] })
  assert.equal(op.disabledCondition, 'ctx.get("profileContext")')
})
