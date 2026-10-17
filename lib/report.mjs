/**
 * Pure report helpers: stable comparison, layer operation summaries, and the
 * per-row provenance trail for a preset's nested plugin rows.
 *
 * Kept separate from `index.mjs` so the fragile parts (JSON-shape comparison,
 * child paths, patch summaries) have direct unit tests.
 * @module dsh-preset-inspector/lib/report
 */

/** @returns the `!!js` condition text on a declared `disabled` value. */
export function conditionOf(disabled) {
  if (typeof disabled === 'string') return disabled
  if (disabled !== null && typeof disabled === 'object' && typeof disabled.__jsExpr === 'string') return disabled.__jsExpr
  return undefined
}

/** @returns a key-order-independent JSON representation, for equality only. */
export function stableString(value) {
  return JSON.stringify(sortValue(value))
}

/** @returns a copy with object keys sorted, recursively. */
function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value === null || typeof value !== 'object') return value
  const out = {}
  for (const key of Object.keys(value).sort()) out[key] = sortValue(value[key])
  return out
}

/** @returns a small, JSON-safe view of one row for before/after display. */
export function compactChild(child) {
  if (child === null || typeof child !== 'object') return child
  const out = {}
  if (child.id !== undefined) out.id = child.id
  if (child.name !== undefined) out.name = child.name
  if (Array.isArray(child.config)) {
    out.group = true
    out.children = child.config.length
  } else if (child.config !== undefined) {
    out.config = child.config
  }
  const condition = conditionOf(child.disabled)
  if (condition !== undefined) out.disabledCondition = condition
  else if (child.disabled === true) out.disabled = true
  return out
}

/**
 * Enumerate a sibling list with stable path segments. Duplicate ids get an
 * ordinal suffix so a later insert cannot make two rows share one path.
 * @param children - one group's child rows.
 * @returns `{ path, child }` entries using the segment within this list.
 */
export function childPaths(children) {
  const out = []
  const counts = new Map()
  for (let index = 0; index < children.length; index++) {
    const child = children[index]
    if (child === null || typeof child !== 'object') continue
    const base = String(child.id ?? child.name ?? '#' + index)
    const seen = counts.get(base) ?? 0
    counts.set(base, seen + 1)
    out.push({ path: seen === 0 ? base : base + '#' + (seen + 1), child })
  }
  return out
}

/**
 * Snapshot a preset's nested rows by path.
 * @param plugins - the preset's `plugins` list.
 * @param parent - path prefix for recursion.
 * @returns a path → row map.
 */
export function childSnapshot(plugins, parent = '') {
  const map = new Map()
  if (!Array.isArray(plugins)) return map
  for (const { path, child } of childPaths(plugins)) {
    const full = parent === '' ? path : parent + '/' + path
    map.set(full, child)
    if (Array.isArray(child.config)) {
      for (const [nested, value] of childSnapshot(child.config, full)) map.set(nested, value)
    }
  }
  return map
}

/**
 * Compare two child snapshots and return the changed rows at one layer.
 * @param previous - the snapshot before the layer, or undefined when new.
 * @param next - the snapshot after the layer.
 * @returns entries with `path`, `action`, and compact before/after values.
 */
export function diffChildMaps(previous, next) {
  const steps = []
  const removed = []
  for (const [path, child] of next) {
    const before = previous?.get(path)
    if (before === undefined) {
      steps.push({ path, action: 'insert', after: compactChild(child) })
    } else if (stableString(before) !== stableString(child)) {
      // A group's child list is already covered by per-path steps; only report
      // the group itself when its own identity/condition changed.
      if (Array.isArray(before.config) && Array.isArray(child.config)) {
        const own = (row) => ({ id: row.id, name: row.name, isolate: row.isolate, disabled: row.disabled })
        if (stableString(own(before)) === stableString(own(child))) continue
      }
      steps.push({ path, action: 'patch', before: compactChild(before), after: compactChild(child) })
    }
  }
  // Only surface the top-most removed path; a removed group's descendants are
  // implied by the group removal and would otherwise flood the trail.
  for (const [path, child] of previous ?? []) {
    if (next.has(path)) continue
    if (removed.some((parent) => path.startsWith(parent + '/'))) continue
    removed.push(path)
    steps.push({ path, action: 'remove', before: compactChild(child) })
  }
  return steps
}

/**
 * Summarize one loader patch entry into the operations a layer performs.
 * @param patch - one parsed `cordis.patch.yml` entry.
 * @returns `{ action, id?, name?, configKeys?, disabled? }` entries.
 */
export function summarizePatch(patch) {
  const ops = []
  if (patch === null || typeof patch !== 'object') return ops
  if (Array.isArray(patch.insert)) {
    for (const row of patch.insert) {
      if (row === null || typeof row !== 'object') continue
      const condition = conditionOf(row.disabled)
      ops.push({
        action: 'insert',
        ...(row.id === undefined ? {} : { id: row.id }),
        ...(row.name === undefined ? {} : { name: row.name }),
        ...(condition === undefined ? (row.disabled === true ? { disabled: true } : {}) : { disabledCondition: condition }),
        ...(row.config !== null && typeof row.config === 'object' && !Array.isArray(row.config) ? { configKeys: Object.keys(row.config) } : {}),
      })
    }
  }
  if (typeof patch.id === 'string') {
    const condition = conditionOf(patch.disabled)
    // The loader's patch `config` replaces the whole config rather than
    // merging keys, so call it replace instead of a partial patch.
    const action = patch.disabled !== undefined ? 'disable' : patch.config !== undefined ? 'replace' : 'touch'
    ops.push({
      action,
      id: patch.id,
      ...(patch.name === undefined ? {} : { name: patch.name }),
      ...(condition === undefined ? {} : { disabledCondition: condition }),
      ...(patch.config !== null && typeof patch.config === 'object' && !Array.isArray(patch.config) ? { configKeys: Object.keys(patch.config) } : {}),
    })
  }
  return ops
}
