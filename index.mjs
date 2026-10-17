/**
 * Host half of dsh-preset-inspector.
 *
 * Composes the running profile's patch layers with the same primitives the
 * `dsh --dump-config` printer uses, then reports — per agent preset — which
 * layer introduced each row, which layer patched it, and what each row's
 * declared config resolves to (package dir, version, disabled condition).
 *
 * The browser half renders that report; this file owns nothing model-visible.
 * @module dsh-preset-inspector
 */

import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PROFILE_PATCH_FILENAME,
  composeEntries,
  loadOverlayPatches,
  loadProfileDirectory,
} from '@deepseek-ai/dsh-app-boot'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { createScope, scopeOf } from '@deepseek-ai/dsh-scope'
import { scanGuidance, scanTools } from './lib/scan.mjs'
import { childPaths, conditionOf, summarizePatch } from './lib/report.mjs'
import {
  composeWithProvenance,
  introducedBy,
  lastChangedBy,
  resolutionRoots,
} from './lib/provenance.mjs'

/** Cordis plugin name. */
export const name = 'preset-inspector'

/** Services read during setup: the preset registry and the fetch route seam. */
export const inject = ['agentPresets', 'connection']

/** The data route the browser half calls. */
const ROUTE = '/api/preset-inspector/data'

/** The probe route: mount one preset and read its registered prompt/tool data. */
const ASSEMBLE_ROUTE = '/api/preset-inspector/assemble'

/** Optional scratch-Agent capture; creates an unpublished Agent and rolls it back. */
const DRY_ROUTE = '/api/preset-inspector/dryrun'

/** Official packages whose rows this inspector understands. */
const PRESET_PLUGIN = '@deepseek-ai/dsh-agent-preset'
const REGISTRY_PLUGIN = '@deepseek-ai/dsh-agent-preset-registry'

let anchorCache

/**
 * Resolve the owning dsh installation's package.json, the anchor that lets
 * bundle packages resolve from the installation rather than the profile.
 * @returns the absolute anchor path, or undefined when resolution fails.
 */
function installAnchor() {
  if (anchorCache !== undefined) return anchorCache
  for (const spec of ['@deepseek-ai/dsh/package.json', '@deepseek-ai/dsh-app-boot/package.json']) {
    try {
      anchorCache = fileURLToPath(import.meta.resolve(spec))
      return anchorCache
    } catch {
      // Try the next candidate; an unresolvable anchor only loses bundle details.
    }
  }
  return undefined
}

/**
 * Read the running profile's directory from the boot-time `baseUrl` (the
 * directory of the composed cordis.yml), which is the profile package dir.
 * @param ctx - the plugin's Cordis context.
 * @returns the profile directory without a trailing separator.
 */
function profileDirOf(ctx) {
  const url = ctx.baseUrl ?? ctx.root?.baseUrl
  if (typeof url !== 'string') throw new Error('profile directory is unavailable on this context')
  // Boot sets `baseUrl` to the profile directory as a file URL with a trailing
  // separator; accept a cordis.yml file URL too, so both shapes resolve.
  const path = fileURLToPath(url).replace(/[\\/]+$/, '')
  return /[.](yml|yaml)$/.test(path) ? dirname(path) : path
}

/**
 * Collect patch layers in boot order: profile bundles, the profile's own
 * cordis.patch.yml, then the home-level layer.
 * @param profileDir - absolute profile package directory.
 * @returns labeled layers (with operation summaries) plus skipped bundles.
 */
function collectLayers(profileDir) {
  const anchor = installAnchor()
  // The profile patch is loaded separately so it can be labeled as its own
  // layer; asking the loader to skip it avoids parsing the same file twice.
  const loaded = loadProfileDirectory('dsh', profileDir, anchor, { userLayer: false })
  const layers = loaded.layers.map((layer, index) => ({
    index,
    label: layer.packageName,
    kind: 'bundle',
    packageDir: layer.packageDir,
    files: layer.patchPaths,
    patches: layer.patches,
    ops: layer.patches.flatMap(summarizePatch),
  }))
  const profilePatch = join(profileDir, PROFILE_PATCH_FILENAME)
  if (existsSync(profilePatch)) {
    const patches = loadOverlayPatches('dsh', profilePatch)
    layers.push({
      index: layers.length,
      label: profilePatch,
      kind: 'profile',
      files: [profilePatch],
      patches,
      ops: patches.flatMap(summarizePatch),
    })
  }
  const homePatch = join(resolveDshHome(), PROFILE_PATCH_FILENAME)
  if (existsSync(homePatch)) {
    const patches = loadOverlayPatches('dsh', homePatch)
    layers.push({
      index: layers.length,
      label: homePatch,
      kind: 'home',
      files: [homePatch],
      patches,
      ops: patches.flatMap(summarizePatch),
    })
  }
  return { layers, skipped: loaded.skippedBundles ?? [] }
}

/**
 * Find the nearest package.json above a resolved entry file.
 * @param entry - absolute entry path.
 * @returns the package root, or undefined.
 */
function packageRootOf(entry) {
  if (typeof entry !== 'string') return undefined
  let dir = dirname(entry)
  for (;;) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * Resolve one child plugin row's package identity without loading it.
 * @param spec - the row's package specifier.
 * @param requireFrom - requires rooted at the profile or declaring bundle dir.
 * @returns `{ version, packageDir, entry }` when the package resolves.
 */
function packageIdentity(spec, requireFrom) {
  if (typeof spec !== 'string' || spec === '') return undefined
  for (const base of requireFrom) {
    try {
      const entry = base.resolve(spec)
      let packageDir
      let version
      try {
        const manifestPath = base.resolve(`${spec}/package.json`)
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
        packageDir = dirname(manifestPath)
        version = manifest.version
      } catch {
        packageDir = packageRootOf(entry)
        if (packageDir !== undefined) {
          try {
            version = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')).version
          } catch {
            version = undefined
          }
        }
      }
      return { version, packageDir, entry }
    } catch {
      // Try the next resolution root.
    }
  }
  return undefined
}

/** @returns cached entry source, or undefined when it cannot be read. */
const sourceCache = new Map()
function readSource(entry) {
  if (typeof entry !== 'string') return undefined
  if (sourceCache.has(entry)) return sourceCache.get(entry)
  let source
  try {
    source = readFileSync(entry, 'utf8')
  } catch {
    source = undefined
  }
  sourceCache.set(entry, source)
  return source
}

/**
 * Drop per-request source snapshots so Reload sees an edited package entry.
 * The cache only exists to deduplicate reads within one composition.
 */
function clearSourceCache() {
  sourceCache.clear()
}

/** Contribution categories the panel groups rows into. */
const CATEGORY = {
  persona: 'persona',
  instructions: 'instructions',
  tool: 'tool',
  skill: 'skill',
  capability: 'capability',
  ui: 'ui',
  other: 'other',
}

/**
 * Where the deployment's global prompt sections come from. The registry keeps
 * the section objects, not their owning package, so this map is deliberately
 * limited to the sections this inspector knows; an unknown one falls back to
 * the generic “deployment” label.
 */
const DEPLOYMENT_SOURCES = {
  'harness:identity': '@deepseek-ai/dsh-system-prompt',
  'deployment:persona-prefix': '@deepseek-ai/dsh-system-prompt',
  'deployment:persona-suffix': '@deepseek-ai/dsh-system-prompt',
  'mcp-resource-servers': '@deepseek-ai/dsh-mcp-resources',
  'harness:source': '@deepseek-ai/dsh-harness-dev-context',
  'app:web-surface': '@deepseek-ai/dsh-harness-dev-context',
  'ui:deliverable-file-references': '@deepseek-ai/dsh-client-ui-deliverables',
}

/** Mirrors SECTION_ORDERS in @deepseek-ai/dsh-system-prompt (0.2.x). */
const SECTION_ORDERS = {
  HARNESS_IDENTITY: -1000,
  DEPLOYMENT_PERSONA_PREFIX: 0,
  PLAN_POLICY: 500,
  TEAM_POLICY: 600,
  PTC_ONLY: 800,
  FILE_REFERENCE: 900,
  TOOL_BASH: 1000,
  TOOL_PWSH: 1010,
  TOOL_READ: 1100,
  TOOL_WRITE: 1200,
  TOOL_EDIT: 1300,
  TOOL_GLOB: 1400,
  TOOL_GREP: 1500,
  TOOL_JOBS: 1600,
  TOOL_PTY: 1700,
  TOOL_WEB_SEARCH: 2000,
  TOOL_WEB_FETCH: 2100,
  TOOL_LSP: 2200,
  TOOL_SESSION_QUERY: 2300,
  TOOL_GOAL: 2400,
  TOOL_WORKFLOW: 2600,
  TOOL_RALPH: 2700,
  TOOL_SUBAGENT: 2800,
  TOOL_REPORT: 2900,
  TOOL_COMPUTER_USE: 3000,
  MCP_SERVERS: 3100,
  TOOLS_SDK: 5000,
  DELIVERABLE_FILE_REFERENCES: 9000,
  STRUCTURED_OUTPUT: 9900,
  HARNESS_SOURCE: 10000,
  WEB_SURFACE: 10100,
  DEPLOYMENT_PERSONA_SUFFIX: 10200,
}

/**
 * Classify one preset row by what it contributes to the agent.
 * @param spec - the row's package specifier.
 * @returns a stable category name.
 */
function categoryOf(spec) {
  const name = String(spec ?? '')
  if (name === '@deepseek-ai/dsh-persona' || /(^|\/)persona$/.test(name)) return CATEGORY.persona
  if (name.includes('agent-instructions')) return CATEGORY.instructions
  if (name.startsWith('@deepseek-ai/dsh-tool-') || name.includes('/tools')) return CATEGORY.tool
  if (name.includes('skill')) return CATEGORY.skill
  if (name.includes('client-ui') || name.includes('client-')) return CATEGORY.ui
  if (name.includes('compaction') || name.includes('plan-mode') || name.includes('goal') || name.includes('working-directory')) return CATEGORY.capability
  return CATEGORY.other
}

/**
 * Flatten nested plugin nodes, depth-first.
 * @param nodes - top-level nodes.
 * @param visit - called for every node.
 */
function walkNodes(nodes, visit) {
  for (const node of nodes ?? []) {
    visit(node)
    if (Array.isArray(node.children)) walkNodes(node.children, visit)
  }
}

/**
 * Find the first node matching a predicate, depth-first.
 * @param nodes - top-level nodes.
 * @param predicate - node test.
 * @returns the node, or undefined.
 */
function findNode(nodes, predicate) {
  let found
  walkNodes(nodes, (node) => {
    if (found === undefined && predicate(node)) found = node
  })
  return found
}

/**
 * Turn one declared plugin row into a report node, recursing into
 * `cordis:group` containers (their `config` is the nested entry list).
 * @param plugin - one entry of a preset's `plugins` list.
 * @param requireFrom - resolution roots for package identity.
 * @param path - stable path inside the preset for provenance lookup.
 * @param childTrail - this preset's path → trail map.
 * @returns the node the panel renders.
 */
function pluginNode(plugin, requireFrom, path, childTrail) {
  const identity = packageIdentity(plugin?.name, requireFrom) ?? {}
  const nested = Array.isArray(plugin?.config) ? plugin.config : undefined
  const trail = childTrail?.get(path) ?? []
  const tools = nested === undefined ? scanTools(readSource(identity.entry), plugin?.config) : []
  const children = []
  if (nested !== undefined) {
    for (const entry of childPaths(nested)) {
      const childPath = path === '' ? entry.path : path + '/' + entry.path
      children.push(pluginNode(entry.child, requireFrom, childPath, childTrail))
    }
  }
  return {
    id: plugin?.id,
    name: plugin?.name,
    path,
    category: categoryOf(plugin?.name),
    group: nested !== undefined,
    isolate: plugin?.isolate,
    tools,
    disabled: plugin?.disabled === true,
    disabledCondition: conditionOf(plugin?.disabled),
    trail,
    sourceLayer: introducedBy(trail),
    lastChangedBy: lastChangedBy(trail),
    ...(nested === undefined ? { config: plugin?.config } : { children }),
    ...identity,
  }
}

/**
 * Build the payload the panel renders for every declared preset.
 * @param ctx - the plugin's Cordis context.
 * @returns the JSON-serializable report.
 */
async function buildReport(ctx) {
  // Reload must observe an edited package entry, so the per-request source
  // cache starts empty every time the report is composed.
  clearSourceCache()
  const profileDir = profileDirOf(ctx)
  const { layers, skipped } = collectLayers(profileDir)
  const { rows, trail, childTrail } = composeWithProvenance(layers, composeEntries, PRESET_PLUGIN)
  const service = ctx.get('agentPresets')
  let listed = []
  if (typeof service?.list === 'function') {
    try {
      listed = await service.list()
    } catch {
      listed = []
    }
  }
  const listedById = new Map(listed.map((entry) => [entry.id, entry]))
  const registry = rows.find((row) => row.name === REGISTRY_PLUGIN)
  let defaultId = registry?.config?.default
  try {
    defaultId = service?.defaultId ?? defaultId
  } catch {
    // A registry without a resolved default keeps the declared fallback.
  }
  const profileRequire = createRequire(join(profileDir, 'package.json'))
  const presets = []
  for (const row of rows) {
    if (row.name !== PRESET_PLUGIN) continue
    const id = row.config?.id
    if (typeof id !== 'string') continue
    const presetTrail = trail.get(row.id ?? row.name) ?? []
    const childSteps = childTrail.get(id) ?? []
    // Resolution roots come from every layer that touched the preset or one
    // of its children. Using only the last layer breaks when a profile/home
    // patch (which has no packageDir) is the most recent step.
    const roots = resolutionRoots([...presetTrail, ...childSteps], layers)
    const requireFrom = [profileRequire]
    for (const dir of roots) {
      try {
        requireFrom.push(createRequire(join(dir, 'package.json')))
      } catch {
        // A layer directory without a package.json only loses resolution.
      }
    }
    const listedRow = listedById.get(id)
    const plugins = Array.isArray(row.config?.plugins) ? row.config.plugins : []
    // childTrail stores the flat step list per preset; pluginNode wants a
    // path → steps map so one row can own several insert/patch steps.
    const pluginTrail = new Map()
    for (const step of childSteps) {
      const steps = pluginTrail.get(step.path) ?? []
      steps.push(step)
      pluginTrail.set(step.path, steps)
    }
    const nodes = childPaths(plugins).map((entry) => pluginNode(entry.child, requireFrom, entry.path, pluginTrail))
    presets.push({
      id,
      rowId: row.id,
      order: row.config?.order ?? listedRow?.order,
      name: row.config?.name ?? listedRow?.name,
      description: row.config?.description ?? listedRow?.description,
      isDefault: id === defaultId,
      broken: listedRow?.broken,
      trail: presetTrail,
      declaredBy: introducedBy(presetTrail),
      lastChangedBy: lastChangedBy(presetTrail),
      plugins: nodes,
    })
  }
  presets.sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
  const toolUsage = new Map()
  for (const preset of presets) {
    walkNodes(preset.plugins, (node) => {
      if (node.disabled) return
      for (const tool of node.tools) {
        const used = toolUsage.get(tool.name) ?? new Set()
        used.add(preset.id)
        toolUsage.set(tool.name, used)
      }
    })
  }
  for (const preset of presets) {
    walkNodes(preset.plugins, (node) => {
      node.tools = node.tools.map((tool) => ({ ...tool, presets: [...(toolUsage.get(tool.name) ?? [])] }))
    })
  }
  const promptRow = rows.find((row) => row.name === '@deepseek-ai/dsh-system-prompt')
  return {
    profile: { dir: profileDir, name: basename(profileDir) },
    systemPrompt: {
      harnessIdentity: promptRow?.config?.includeHarnessIdentity !== false,
      personaPrefix: promptRow?.config?.personaPrefix ?? '',
      personaSuffix: promptRow?.config?.personaSuffix ?? '',
    },
    layers: layers.map((layer) => ({
      index: layer.index,
      label: layer.label,
      kind: layer.kind,
      patches: layer.patches.length,
      files: layer.files,
      ops: layer.ops,
    })),
    presets,
    skipped,
  }
}

/**
 * Flatten a JSON Schema object into the drawer's parameter list.
 * @param schema - a tool's `parameters` schema.
 * @returns `{ name, type?, required, description? }` entries.
 */
function schemaParameters(schema) {
  const properties = schema?.properties
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) return []
  const required = new Set(Array.isArray(schema.required) ? schema.required : [])
  return Object.entries(properties).map(([name, spec]) => ({
    name,
    required: required.has(name),
    ...(typeof spec?.type === 'string' ? { type: spec.type } : {}),
    ...(typeof spec?.description === 'string' ? { description: spec.description } : {}),
  }))
}

/**
 * Normalize one model-facing tool schema for the panel. The mount assembly is
 * the authoritative source; `schema` is kept for the drawer's raw view.
 * @param tool - `{ name, description, parameters }` from tools.schemas() or assemble().
 * @param sourceKind - `assembly` or `mount`.
 * @returns the tool row the browser renders.
 */
function runtimeTool(tool, sourceKind) {
  return {
    name: tool.name,
    ...(typeof tool.description === 'string' ? { description: tool.description } : {}),
    parameters: schemaParameters(tool.parameters),
    ...(tool.parameters !== undefined ? { schema: tool.parameters } : {}),
    runtime: true,
    sourceKind,
  }
}

/**
 * Collect static tool/guidance owners for attribution only. The definitions
 * themselves come from the mount assembly; this map only supplies package
 * names when the runtime schema has no owner field.
 * @param nodes - the preset's static plugin tree.
 * @returns `{ tools, sections }` name → declaring package maps.
 */
function staticOwners(nodes) {
  const tools = new Map()
  const sections = new Map()
  walkNodes(nodes, (node) => {
    if (node.disabled) return
    for (const tool of node.tools ?? []) tools.set(tool.name, node.name)
    for (const entry of scanGuidance(readSource(node.entry), node.config)) sections.set(entry.name, node.name)
  })
  return { tools, sections }
}

/**
 * Mount one declared preset in an isolated scope and read the prompt sections

 * and tools its plugins register. Nothing touches a session, a log, or a
 * user's agent: the probe owns its scope, suppresses optional runtime context,
 * reads the scoped registries, and disposes.
 * @param ctx - the plugin's Cordis context (host scope).
 * @param presetId - the declared preset id to mount.
 * @returns sections, context slots, runtime tools, and their origin.
 */
async function assemblePreset(ctx, presetId) {
  const presets = ctx.get('agentPresets')
  if (presets === undefined) throw new Error('agent presets service is unavailable')
  const probe = createScope(ctx, Symbol('preset-inspector-probe'))
  try {
    await presets.mount(probe.ctx, presetId)
    const systemPrompt = probe.ctx.get('systemPrompt')
    if (systemPrompt === undefined) throw new Error('system prompt service is unavailable in the probe scope')
    // Optional runtime context providers need a live Session; suppressing them
    // keeps this probe free of any session while leaving sections intact.
    systemPrompt.suppressRuntimeContext()
    const layers = systemPrompt.layers
    const probeScope = scopeOf(probe.ctx)
    if (probeScope === undefined) throw new Error('probe scope is unavailable')
    // Activation of the mounted tree is asynchronous; wait until the section
    // registry stops changing so a probe never reports a half-mounted preset.
    let previous = -1
    let stable = 0
    for (let attempt = 0; attempt < 20; attempt++) {
      const size = layers.merge(probeScope, (layer) => layer.sections).size
      if (size === previous) {
        // Require two stable polls: one stable pair can happen between two
        // asynchronous rows activating.
        stable++
        if (stable >= 2) break
      } else {
        stable = 0
        previous = size
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const scopedSections = [...layers.merge(probeScope, (layer) => layer.sections).values()]
    const baseSections = layers.merge(undefined, (layer) => layer.sections)
    const baseContexts = layers.merge(undefined, (layer) => layer.contexts)
    const contexts = [...layers.merge(probeScope, (layer) => layer.contexts).values()].map((entry) => ({
      name: entry.name,
      order: entry.order,
      required: entry.required === true,
      origin: baseContexts.get(entry.name) === entry ? 'deployment' : 'preset',
    }))

    // The real assembly is the authoritative mount-time answer: it applies
    // complete-section rules, evaluates every function-valued text with this
    // scope, and asks the tool providers for the exact model-facing schemas.
    let assembly
    let assemblyError
    try {
      assembly = await systemPrompt.assemble({ scope: probeScope })
    } catch (error) {
      assemblyError = errorMessage(error)
    }

    let tools = []
    let toolsSource = 'none'
    if (Array.isArray(assembly?.tools) && assembly.tools.length > 0) {
      tools = assembly.tools.map((tool) => runtimeTool(tool, 'assembly'))
      toolsSource = 'assembly'
    } else {
      const toolsService = probe.ctx.get('tools')
      try {
        const schemas = typeof toolsService?.schemas === 'function' ? toolsService.schemas(probeScope) : undefined
        if (Array.isArray(schemas)) {
          tools = schemas.map((tool) => runtimeTool(tool, 'mount'))
          toolsSource = 'mount'
        }
      } catch (error) {
        if (assemblyError === undefined) assemblyError = errorMessage(error)
      }
    }

    let sections
    if (Array.isArray(assembly?.sections)) {
      const definitions = new Map(scopedSections.map((section) => [section.name, section]))
      sections = assembly.sections.map((section) => {
        const definition = definitions.get(section.name)
        const deployment = definition !== undefined && baseSections.get(section.name) === definition
        return {
          name: section.name,
          order: definition?.order,
          text: typeof section.text === 'string' ? section.text : undefined,
          textSource: 'assembly',
          complete: definition?.complete === true,
          // A global section is the deployment's; a different object is the
          // preset shadowing or adding it.
          origin: definition === undefined ? 'preset' : deployment ? 'deployment' : 'preset',
          ...(definition !== undefined && deployment && DEPLOYMENT_SOURCES[section.name] !== undefined
            ? { source: DEPLOYMENT_SOURCES[section.name] }
            : {}),
        }
      })
    } else {
      // Assembly is unavailable (for example an Agent-only section threw).
      // Fall back to the registered definitions plus per-section evaluation.
      const probeResults = new Map()
      for (const section of scopedSections) {
        if (typeof section.text !== 'function') continue
        try {
          const text = section.text({ scope: probeScope })
          probeResults.set(section.name, typeof text === 'string' && text !== ''
            ? { status: 'text', text }
            : { status: 'empty' })
        } catch (error) {
          probeResults.set(section.name, { status: 'error', error: errorMessage(error) })
        }
      }
      sections = scopedSections.map((section) => {
        const deployment = baseSections.get(section.name) === section
        const staticText = typeof section.text === 'string' ? section.text : undefined
        const probeResult = probeResults.get(section.name)
        const useProbe = (staticText === undefined || staticText === '') && probeResult?.status === 'text'
        return {
          name: section.name,
          order: section.order,
          text: useProbe ? probeResult.text : staticText,
          ...(useProbe ? { textSource: 'probe', runtimeDependent: true } : {}),
          complete: section.complete === true,
          origin: deployment ? 'deployment' : 'preset',
          ...(probeResult === undefined ? {} : { probe: probeResult }),
          ...(deployment && DEPLOYMENT_SOURCES[section.name] !== undefined ? { source: DEPLOYMENT_SOURCES[section.name] } : {}),
        }
      })
    }

    const report = await buildReport(ctx)
    const declared = report.presets.find((preset) => preset.id === presetId)
    const owners = declared === undefined ? { tools: new Map(), sections: new Map() } : staticOwners(declared.plugins)
    for (const tool of tools) {
      const source = owners.tools.get(tool.name)
      if (source !== undefined) tool.source = source
      tool.presets = [presetId]
    }
    for (const section of sections) {
      if (section.source !== undefined) continue
      const source = owners.sections.get(section.name)
      if (source !== undefined) section.source = source
    }

    // Static guidance is only a fallback when the assembly could not be read;
    // adding it beside an authoritative assembly would reintroduce false rows.
    if (!Array.isArray(assembly?.sections)) {
      const byName = new Map(sections.map((section) => [section.name, section]))
      const guidance = []
      const visit = (node) => {
        // A hard-disabled row contributes no prompt text.
        if (node.disabled) return
        // A row may gate individual tools off through boolean config flags
        // (`read: false`); only those names are filtered, never the composite
        // sections (`tool:jobs`, `tool:goal`) whose tool ids differ.
        const gated = new Set(
          Object.entries(node.config ?? {})
            .filter(([, value]) => value === false)
            .map(([key]) => key.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())),
        )
        for (const entry of scanGuidance(readSource(node.entry), node.config)) {
          if (entry.name.startsWith('tool:') && gated.has(entry.name.slice(5))) continue
          const order = entry.orderName === undefined ? undefined : SECTION_ORDERS[entry.orderName]
          const existing = byName.get(entry.name)
          if (existing !== undefined) {
            existing.source = node.name
            if (existing.origin === 'preset') existing.origin = 'package'
            if ((existing.text === undefined || existing.text === '') && entry.text !== undefined) {
              existing.text = entry.text
              existing.runtimeDependent = true
              existing.textIsHint = true
            } else if (existing.textSource === 'probe' && entry.text !== undefined && entry.text !== existing.text) {
              existing.staticHint = entry.text
            }
            continue
          }
          byName.set(entry.name, { name: entry.name })
          guidance.push({
            name: entry.name,
            ...(order === undefined ? {} : { order }),
            text: entry.text,
            runtimeDependent: entry.runtimeDependent === true,
            ...(entry.text !== undefined && entry.runtimeDependent ? { textIsHint: true } : {}),
            complete: false,
            origin: 'package',
            source: node.name,
          })
        }
      }
      if (declared !== undefined) walkNodes(declared.plugins, visit)
      sections = [...sections, ...guidance]
    }

    return {
      preset: presetId,
      sections,
      contexts,
      tools,
      toolsSource,
      ...(assemblyError === undefined ? {} : { assemblyError }),
    }
  } finally {
    await probe.dispose()
  }
}

/**
 * Capture one preset from inside a real, unpublished Agent setup and then
 * abort the setup. The factory's rollback closes the unmaterialized session,
 * so this runs Agent-scoped registrations without publishing a session.
 * @param ctx - the plugin's Cordis context.
 * @param presetId - declared preset id to bind.
 * @returns Agent-time tools, sections, contexts, and any assembly error.
 */
async function captureAgentPreset(ctx, presetId) {
  const agents = ctx.get('agents')
  const presets = ctx.get('agentPresets')
  if (typeof agents?.create !== 'function') throw new Error('agent service is unavailable')
  if (presets === undefined) throw new Error('agent presets service is unavailable')
  const sentinel = new Error('preset-inspector dry run complete')
  let captured
  try {
    await agents.create({
      sessionId: `preset-inspector-dry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      setup: async (agentCtx, agent) => {
        await presets.mount(agentCtx, presetId)
        const scope = scopeOf(agentCtx)
        if (scope === undefined) throw new Error('agent scope is unavailable')
        const prompt = agentCtx.get('systemPrompt')
        if (prompt === undefined) throw new Error('system prompt service is unavailable in the Agent scope')
        const toolsService = agentCtx.get('tools')
        let assembly
        let assemblyError
        try {
          assembly = await prompt.assemble({ scope, agent })
        } catch (error) {
          assemblyError = errorMessage(error)
        }
        const schemas = Array.isArray(assembly?.tools)
          ? assembly.tools
          : (typeof toolsService?.schemas === 'function' ? toolsService.schemas(scope) : [])
        const definitions = new Map([...prompt.layers.merge(scope, (layer) => layer.sections).values()].map((section) => [section.name, section]))
        const baseSections = prompt.layers.merge(undefined, (layer) => layer.sections)
        const sections = Array.isArray(assembly?.sections)
          ? assembly.sections.map((section) => {
            const definition = definitions.get(section.name)
            return {
              name: section.name,
              order: definition?.order,
              text: typeof section.text === 'string' ? section.text : undefined,
              textSource: 'agent',
              complete: definition?.complete === true,
              origin: definition === undefined || baseSections.get(section.name) !== definition ? 'preset' : 'deployment',
            }
          })
          : []
        const baseContexts = prompt.layers.merge(undefined, (layer) => layer.contexts)
        const contexts = [...prompt.layers.merge(scope, (layer) => layer.contexts).values()].map((entry) => ({
          name: entry.name,
          order: entry.order,
          required: entry.required === true,
          origin: baseContexts.get(entry.name) === entry ? 'deployment' : 'preset',
        }))
        captured = {
          tools: schemas.map((tool) => runtimeTool(tool, 'agent')),
          sections,
          contexts,
          ...(assemblyError === undefined ? {} : { assemblyError }),
        }
        throw sentinel
      },
    })
  } catch (error) {
    // The setup always throws the sentinel; a factory wrapper may preserve its
    // message rather than its identity, so accept either shape.
    if (captured === undefined) throw error
    if (error !== sentinel && errorMessage(error) !== errorMessage(sentinel)) {
      return { ...captured, warning: errorMessage(error) }
    }
  }
  if (captured === undefined) throw new Error('dry run finished without a capture')
  return captured
}

/** @returns a JSON response no browser or proxy may cache. */
function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** @returns a message from an unknown throwable. */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Register the browser-facing data and probe routes.
 * @param ctx - the plugin's Cordis context.
 */
export function apply(ctx) {
  const connection = ctx.get('connection')
  const register = typeof connection?.fetch?.register === 'function' ? connection.fetch.register.bind(connection.fetch) : undefined
  if (register === undefined) return
  ctx.effect(
    () =>
      register({
        path: ASSEMBLE_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let presetId = ''
          try {
            const body = await request.json()
            if (typeof body?.preset === 'string') presetId = body.preset.trim()
          } catch {
            presetId = ''
          }
          if (presetId === '') return jsonResponse({ ok: false, error: 'preset id is required' }, 400)
          if (presetId.length > 200) return jsonResponse({ ok: false, error: 'preset id is too long' }, 400)
          try {
            return jsonResponse({ ok: true, ...(await assemblePreset(ctx, presetId)) })
          } catch (error) {
            return jsonResponse({ ok: false, error: errorMessage(error) }, 500)
          }
        },
      }),
    'preset-inspector: assemble route',
  )
  ctx.effect(
    () =>
      register({
        path: DRY_ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          let presetId = ''
          try {
            const body = await request.json()
            if (typeof body?.preset === 'string') presetId = body.preset.trim()
          } catch {
            presetId = ''
          }
          if (presetId === '') return jsonResponse({ ok: false, error: 'preset id is required' }, 400)
          if (presetId.length > 200) return jsonResponse({ ok: false, error: 'preset id is too long' }, 400)
          try {
            return jsonResponse({ ok: true, ...(await captureAgentPreset(ctx, presetId)) })
          } catch (error) {
            return jsonResponse({ ok: false, error: errorMessage(error) }, 500)
          }
        },
      }),
    'preset-inspector: dry-run route',
  )
  ctx.effect(
    () =>
      register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async () => {
          try {
            return jsonResponse({ ok: true, ...(await buildReport(ctx)) })
          } catch (error) {
            return jsonResponse({ ok: false, error: errorMessage(error) }, 500)
          }
        },
      }),
    'preset-inspector: data route',
  )
}
