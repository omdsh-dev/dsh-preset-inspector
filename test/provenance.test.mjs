import assert from 'node:assert/strict'
import { test } from 'node:test'
import { composeWithProvenance, introducedBy, lastChangedBy, resolutionRoots } from '../lib/provenance.mjs'

const PRESET = '@deepseek-ai/dsh-agent-preset'

/**
 * Minimal stand-in for the loader's composer: inserts win, a targeted config
 * patch replaces the whole config (matching `dsh-app-boot` semantics).
 */
function compose(patchesByLayer) {
  const rows = new Map()
  for (const patches of patchesByLayer) {
    for (const patch of patches) {
      if (Array.isArray(patch.insert)) {
        for (const row of patch.insert) rows.set(row.id, structuredClone(row))
      } else if (typeof patch.id === 'string' && patch.config !== undefined) {
        const current = rows.get(patch.id)
        if (current !== undefined) rows.set(patch.id, { ...current, config: structuredClone(patch.config) })
      } else if (typeof patch.id === 'string' && patch.disabled === true) {
        const current = rows.get(patch.id)
        if (current !== undefined) rows.set(patch.id, { ...current, disabled: true })
      }
    }
  }
  return [...rows.values()]
}

const preset = (plugins) => ({
  id: 'preset-p',
  name: PRESET,
  config: { id: 'p', plugins },
})

test('provenance separates the inserting layer from the last patch layer', () => {
  const layers = [
    { index: 0, label: 'bundle-a', packageDir: '/bundle-a', patches: [{ insert: [preset([{ id: 'a', name: 'pkg-a' }])] }] },
    { index: 1, label: 'profile', patches: [{ id: 'preset-p', config: { id: 'p', plugins: [{ id: 'a', name: 'pkg-a' }, { id: 'b', name: 'pkg-b' }] } }] },
  ]
  const { rows, trail, childTrail } = composeWithProvenance(layers, compose, PRESET)
  assert.equal(rows.length, 1)
  const steps = trail.get('preset-p')
  assert.deepEqual(steps.map((step) => step.action), ['insert', 'patch'])
  assert.equal(introducedBy(steps), 'bundle-a')
  assert.equal(lastChangedBy(steps), 'profile')
  assert.deepEqual(resolutionRoots([...steps, ...childTrail.get('p')], layers), ['/bundle-a'])
  assert.deepEqual(childTrail.get('p').map((step) => [step.path, step.action]), [
    ['a', 'insert'],
    ['b', 'insert'],
  ])
})

test('child trail records removals at the layer that removed the row', () => {
  const layers = [
    { index: 0, label: 'bundle-a', patches: [{ insert: [preset([{ id: 'a', name: 'pkg-a' }, { id: 'b', name: 'pkg-b' }])] }] },
    { index: 1, label: 'profile', patches: [{ id: 'preset-p', config: { id: 'p', plugins: [{ id: 'b', name: 'pkg-b' }] } }] },
  ]
  const { childTrail } = composeWithProvenance(layers, compose, PRESET)
  const removal = childTrail.get('p').find((step) => step.action === 'remove')
  assert.equal(removal.path, 'a')
  assert.equal(removal.layer, 1)
  assert.deepEqual(removal.before, { id: 'a', name: 'pkg-a' })
})

test('top-level removal drops the row but keeps a trail step', () => {
  const layers = [
    { index: 0, label: 'bundle-a', patches: [{ insert: [{ id: 'x', name: 'pkg-x' }] }] },
    { index: 1, label: 'profile', patches: [{ remove: ['x'] }] },
  ]
  // The real composer would not return x after the removal; emulate that.
  const composeWithRemoval = (patchesByLayer) => compose(patchesByLayer).filter((row) => {
    const removed = patchesByLayer.flat().some((patch) => Array.isArray(patch.remove) && patch.remove.includes(row.id))
    return !removed
  })
  const { rows, trail } = composeWithProvenance(layers, composeWithRemoval, PRESET)
  assert.deepEqual(rows, [])
  assert.deepEqual(trail.get('x').map((step) => step.action), ['insert', 'remove'])
})

test('resolutionRoots deduplicates and ignores layers without a packageDir', () => {
  const layers = [
    { index: 0, label: 'a', packageDir: '/a' },
    { index: 1, label: 'profile' },
    { index: 2, label: 'b', packageDir: '/b' },
  ]
  assert.deepEqual(resolutionRoots([{ layer: 0 }, { layer: 1 }, { layer: 2 }, { layer: 0 }], layers), ['/a', '/b'])
})
