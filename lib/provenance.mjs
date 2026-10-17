/**
 * Pure provenance helpers: compose layers through an injected composer and
 * record which layer introduced or changed each row.
 *
 * Kept out of `index.mjs` so synthetic layer sequences can be unit-tested
 * without a running Harness or the official boot packages.
 * @module dsh-preset-inspector/lib/provenance
 */

import { childSnapshot, diffChildMaps, stableString } from './report.mjs'

/**
 * @param trail - a row's ordered trail steps.
 * @returns the label of the layer that inserted the row, when known.
 */
export function introducedBy(trail) {
  return trail?.find((step) => step.action === 'insert')?.label ?? trail?.[0]?.label
}

/**
 * @param trail - a row's ordered trail steps.
 * @returns the label of the last layer that touched the row.
 */
export function lastChangedBy(trail) {
  return trail?.at(-1)?.label
}

/**
 * Collect the package roots that can resolve a preset's child packages. A
 * preset may be inserted by one bundle and patched by a later layer; every
 * layer that touched the row (or one of its children) is a candidate root.
 * @param steps - the preset row trail plus its child trails.
 * @param layers - labeled layers in boot order.
 * @returns unique package directories, in trail order.
 */
export function resolutionRoots(steps, layers) {
  const roots = []
  for (const step of steps ?? []) {
    const dir = layers[step.layer]?.packageDir
    if (typeof dir === 'string' && dir !== '' && !roots.includes(dir)) roots.push(dir)
  }
  return roots
}

/**
 * Compose layers incrementally and record provenance:
 *  - top-level rows: which layer inserted, changed, or removed them;
 *  - nested preset rows: which layer inserted or changed each child path.
 * Row ids repeat across layers only when a later patch targets the same id, so
 * the trail is exactly the row's provenance.
 * @param layers - labeled layers in boot order.
 * @param compose - the loader's entry composer (`composeEntries`).
 * @param presetPlugin - package name of the agent-preset row.
 * @returns the final row map, top-level trails, and per-preset child trails.
 */
export function composeWithProvenance(layers, compose, presetPlugin = '@deepseek-ai/dsh-agent-preset') {
  const acc = []
  const byId = new Map()
  const trail = new Map()
  const childTrail = new Map()
  const childSnapshots = new Map()
  for (const layer of layers) {
    acc.push(layer.patches)
    const rows = compose(acc)
    const present = new Set()
    for (const row of rows) {
      const id = row.id ?? row.name
      if (id === undefined) continue
      present.add(id)
      const before = byId.get(id)
      const action = before === undefined ? 'insert' : stableString(before) === stableString(row) ? 'unchanged' : 'patch'
      if (action !== 'unchanged') {
        const steps = trail.get(id) ?? []
        steps.push({ layer: layer.index, label: layer.label, action })
        trail.set(id, steps)
      }
      byId.set(id, row)
      if (row.name === presetPlugin && typeof row.config?.id === 'string') {
        const presetId = row.config.id
        const current = childSnapshot(row.config.plugins)
        const previous = childSnapshots.get(presetId)
        const steps = childTrail.get(presetId) ?? []
        for (const step of diffChildMaps(previous, current)) {
          steps.push({ layer: layer.index, label: layer.label, ...step })
        }
        if (steps.length > 0) childTrail.set(presetId, steps)
        childSnapshots.set(presetId, current)
      }
    }
    // A later layer can remove a row. Keep the removal in the trail and drop
    // the stale row from the final report instead of silently retaining it.
    for (const id of [...byId.keys()]) {
      if (present.has(id)) continue
      const row = byId.get(id)
      if (row?.name === presetPlugin && typeof row.config?.id === 'string') {
        // A re-inserted preset starts a new child snapshot instead of diffing
        // against rows from its previous life.
        childSnapshots.delete(row.config.id)
      }
      const steps = trail.get(id) ?? []
      steps.push({ layer: layer.index, label: layer.label, action: 'remove' })
      trail.set(id, steps)
      byId.delete(id)
    }
  }
  return { rows: [...byId.values()], trail, childTrail }
}
