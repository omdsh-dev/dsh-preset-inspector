/**
 * Static readers for official plugin packages.
 *
 * The inspector prefers runtime registries (a probe mount sees the real tool
 * table); this module is the fallback for rows whose plugins cannot activate in
 * a bare scope, so it must understand the shapes official packages actually
 * use: literal names, `config`-derived names, zod defaults, template literals,
 * and function-valued prompt text.
 *
 * Everything here is pure and synchronous so it can be unit-tested without a
 * Harness runtime. Brace matching skips strings, template literals, comments, and
 * regex literals; a naive counter would stop inside a description.
 * @module dsh-preset-inspector/lib/scan
 */


/** @returns whether a `/` at `index` starts a regex literal rather than a division. */
function isRegexStart(source, index) {
  let i = index - 1
  while (i >= 0 && /\s/.test(source[i])) i--
  if (i < 0) return true
  const previous = source[i]
  if ('([{=,:;!&|?+-*%^~<>'.includes(previous)) return true
  const word = /([A-Za-z_$][\w$]*)\s*$/.exec(source.slice(0, index))
  return word !== null && ['return', 'typeof', 'case', 'delete', 'void', 'new', 'in', 'of', 'yield', 'await'].includes(word[1])
}

/** @returns the index of the closing `/` of a regex literal, or -1. */
function regexEnd(source, start) {
  let inClass = false
  let escape = false
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i]
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '[') {
      inClass = true
      continue
    }
    if (char === ']') {
      inClass = false
      continue
    }
    if (char === '/' && !inClass) return i
    if (char === '\n') return -1
  }
  return -1
}

/** @returns whether `index` sits in JavaScript code (not a string or comment). */
export function isCodeIndex(source, index) {
  let quote
  let escape = false
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < index; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote !== undefined) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === quote) quote = undefined
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (char === '/' && isRegexStart(source, i)) {
      const end = regexEnd(source, i)
      if (end >= 0) {
        i = end
        continue
      }
    }
    if (char === "'" || char === '"' || char === '`') quote = char
  }
  return !lineComment && !blockComment && quote === undefined
}

/** @returns the index of the `}` that closes `open`, or -1. */
export function matchBlock(source, open) {
  if (open < 0 || source[open] !== '{') return -1
  let depth = 0
  let quote
  let escape = false
  let lineComment = false
  let blockComment = false
  for (let i = open; i < source.length; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote !== undefined) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === quote) quote = undefined
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (char === '/' && isRegexStart(source, i)) {
      const end = regexEnd(source, i)
      if (end >= 0) {
        i = end
        continue
      }
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{') depth++
    else if (char === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return -1
}

/**
 * Read the expression that starts at `at`, stopping at a top-level `,`/`}`.
 * Only the shapes worth resolving are returned with their raw source.
 * @param source - the enclosing source text.
 * @param at - index of the first non-space character of the expression.
 * @returns `{ kind, raw, value, end }`.
 */
export function readExpression(source, at) {
  let i = at
  while (i < source.length && /\s/.test(source[i])) i++
  const first = source[i]
  if (first === '"' || first === "'" || first === '`') {
    const quote = first
    let raw = ''
    let escape = false
    for (i = i + 1; i < source.length; i++) {
      const char = source[i]
      if (escape) {
        raw += char
        escape = false
        continue
      }
      if (char === '\\') {
        raw += char
        escape = true
        continue
      }
      if (char === quote) {
        return { kind: quote === '`' ? 'template' : 'literal', raw, value: quote === '`' ? raw : unescape(raw), end: i + 1 }
      }
      raw += char
    }
    return { kind: 'literal', raw, value: unescape(raw), end: i }
  }
  let raw = ''
  let depth = 0
  for (; i < source.length; i++) {
    const char = source[i]
    if (char === '{' || char === '[' || char === '(') depth++
    else if (char === '}' || char === ']' || char === ')') {
      if (depth === 0) break
      depth--
    } else if (char === ',' && depth === 0) break
    raw += char
  }
  const trimmed = raw.trim()
  return { kind: 'other', raw: trimmed, value: undefined, end: i }
}

/**
 * Unescape the subset of JS string escapes that appears in plugin sources.
 * @param raw - string contents without the surrounding quotes.
 * @returns the decoded text.
 */
export function unescape(raw) {
  return raw.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|b|f|v|0|\\|'|"|`)/g, (whole, code) => {
    if (code.startsWith('u{')) return String.fromCodePoint(Number.parseInt(code.slice(2, -1), 16))
    if (code.startsWith('u')) return String.fromCharCode(Number.parseInt(code.slice(1), 16))
    if (code.startsWith('x')) return String.fromCharCode(Number.parseInt(code.slice(1), 16))
    const table = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0', '\\': '\\', "'": "'", '"': '"', '`': '`' }
    return table[code] ?? whole
  })
}

/** @returns the value expression for one object property, or undefined. */
function propertyExpression(body, key) {
  const pattern = new RegExp(`\\b${key}\\s*:\\s*`, 'g')
  let match
  while ((match = pattern.exec(body)) !== null) {
    // A description string may contain "name:"; only object-level keys count.
    if (depthAt(body, match.index) !== 0) continue
    return readExpression(body, match.index + match[0].length)
  }
  return undefined
}

/** @returns the first literal/identifier value of a `const` declaration. */
function constExpression(source, name) {
  const pattern = new RegExp(`(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*`, 'g')
  const match = pattern.exec(source)
  if (match === null) return undefined
  return readExpression(source, match.index + match[0].length)
}

/** @returns the default literal of a schemastery string field, if declared. */
function schemaDefault(source, name) {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*:\\s*z\\.[\\w.]+\\(\\)\\.default\\(\\s*`, 'g')
  const match = pattern.exec(source)
  if (match === null) return undefined
  return readExpression(source, match.index + match[0].length)
}

/** @returns a regex-escaped literal. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve a name/description expression against the row's declared config and,
 * failing that, the file's own constants and schema defaults.
 * @param expression - value returned by {@link readExpression}.
 * @param options - `{ config, source }`.
 * @returns the resolved string, or undefined when it is genuinely dynamic.
 */
export function resolveExpression(expression, { config, source }) {
  if (expression === undefined) return undefined
  if (expression.kind === 'literal') return expression.value
  if (expression.kind === 'template') {
    let dynamic = false
    const text = expression.raw.replace(/\$\{([^}]+)\}/g, (whole, inner) => {
      const name = inner.trim()
      const value = resolveName(name, { config, source })
      if (value === undefined) {
        dynamic = true
        return whole
      }
      return value
    })
    return dynamic ? undefined : unescape(text)
  }
  const name = expression.raw.trim()
  if (!/^[A-Za-z_$][\w$]*$/.test(name)) return undefined
  return resolveName(name, { config, source })
}

/** @returns the value of one identifier from config, file constants, or schema defaults. */
function resolveName(name, { config, source }) {
  if (config !== null && typeof config === 'object') {
    const value = config[name]
    if (typeof value === 'string') return value
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  }
  const constant = constExpression(source, name)
  if (constant !== undefined) {
    const resolved = resolveExpression(constant, { config, source })
    if (resolved !== undefined) return resolved
  }
  const fallback = schemaDefault(source, name)
  if (fallback !== undefined) return resolveExpression(fallback, { config, source })
  return undefined
}

/** @returns the brace depth at `index`, ignoring strings and comments. */
function depthAt(source, index) {
  let depth = 0
  let quote
  let escape = false
  let lineComment = false
  let blockComment = false
  for (let i = 0; i < index; i++) {
    const char = source[i]
    const next = source[i + 1]
    if (lineComment) {
      if (char === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote !== undefined) {
      if (escape) {
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === quote) quote = undefined
      continue
    }
    if (char === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (char === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (char === '/' && isRegexStart(source, i)) {
      const end = regexEnd(source, i)
      if (end >= 0) {
        i = end
        continue
      }
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char
      continue
    }
    if (char === '{' || char === '[' || char === '(') depth++
    else if (char === '}' || char === ']' || char === ')') depth--
  }
  return depth
}

/**
 * Read a parameter's own `required: true` at object depth zero.
 * @param body - the parameter's inner object source.
 * @param options - `{ config, source }` for a resolvable expression.
 * @returns whether the parameter itself is required.
 */
function requiredOf(body) {
  const expression = propertyExpression(body, 'required')
  if (expression === undefined || expression.kind !== 'other') return false
  return expression.raw.trim() === 'true'
}

/**
 * Read one tool's declared parameters from its `parameters: { ... }` block.
 * Nested object schemas are reported as type `object` without recursion.
 * @param body - the `defineTool({...})` body.
 * @param options - `{ config, source }`.
 * @returns parameter descriptors in declaration order.
 */
export function parametersOf(body, options = { config: undefined, source: '' }) {
  const at = body.search(/\bparameters:\s*\{/)
  if (at < 0) return []
  const open = body.indexOf('{', at)
  const end = matchBlock(body, open)
  if (end < 0) return []
  const block = body.slice(open + 1, end)
  const out = []
  const entry = /(["']?)([A-Za-z_$][\w$]*)\1\s*:\s*\{/g
  for (let match = entry.exec(block); match !== null; match = entry.exec(block)) {
    if (depthAt(block, match.index) !== 0) continue
    const propertyOpen = match.index + match[0].length - 1
    const propertyEnd = matchBlock(block, propertyOpen)
    if (propertyEnd < 0) continue
    const slice = block.slice(match.index, propertyEnd + 1)
    // Drop the property's own braces so its fields sit at depth zero.
    const inner = slice.slice(slice.indexOf('{') + 1, slice.lastIndexOf('}'))
    const type = propertyExpression(inner, 'type')
    const description = propertyExpression(inner, 'description')
    const typeValue = resolveExpression(type, options)
    const descriptionValue = resolveExpression(description, options)
    out.push({
      name: match[2],
      ...(typeValue === undefined ? {} : { type: typeValue }),
      required: requiredOf(inner),
      ...(descriptionValue === undefined ? {} : { description: descriptionValue }),
    })
  }
  return out
}

/**
 * Read the tools a package registers from its resolved entry.
 * @param source - the package entry source.
 * @param config - the row's declared config (gating flags and name inputs).
 * @returns `{ name, description?, parameters }` entries, sorted by name.
 */
export function scanTools(source, config) {
  if (typeof source !== 'string' || source === '') return []
  const tools = new Map()
  const marker = 'defineTool('
  for (let at = source.indexOf(marker); at >= 0; at = source.indexOf(marker, at + 1)) {
    if (!isCodeIndex(source, at)) continue
    const open = source.indexOf('{', at)
    if (open < 0) continue
    const end = matchBlock(source, open)
    if (end < 0) continue
    const body = source.slice(open + 1, end)
    const name = resolveExpression(propertyExpression(body, 'name'), { config, source })
    if (name === undefined || name === '') continue
    const description = resolveExpression(propertyExpression(body, 'description'), { config, source })
    tools.set(name, {
      name,
      ...(description === undefined ? {} : { description }),
      parameters: parametersOf(body, { config, source }),
    })
  }
  const gated = new Set(
    Object.entries(config ?? {})
      .filter(([, value]) => value === false)
      .map(([key]) => key.replace(/[A-Z]/g, (letter) => '_' + letter.toLowerCase())),
  )
  return [...tools.values()]
    .filter((tool) => !gated.has(tool.name))
    .sort((left, right) => left.name.localeCompare(right.name))
}



/** @returns whether a function-body string is safe to show as a prompt hint. */
function looksLikeProse(value) {
  if (typeof value !== 'string' || value.length < 30) return false
  if (!/[A-Za-z\u4e00-\u9fff]/.test(value)) return false
  // Code fragments and nested template slices are common false positives; a
  // hint must read like text, not like the function body around it.
  if (/[\n\r\t]/.test(value)) return false
  if (/(?:=>|\breturn\b|\bconst\b|\blet\b|\bvar\b|runtimeCtx|\bctx\.)/.test(value)) return false
  if (/^[\s,;:{}()[\]]/.test(value)) return false
  return true
}

/** @returns the longest resolvable string literal in `slice`, or undefined. */
function longestString(slice, options) {
  const pattern = /(["'`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g
  let best
  for (let match = pattern.exec(slice); match !== null; match = pattern.exec(slice)) {
    const raw = match[2]
    if (raw.length < 30) continue
    const value = match[1] === '`'
      ? resolveExpression({ kind: 'template', raw, value: raw }, options)
      : unescape(raw)
    if (value !== undefined && looksLikeProse(value) && value.length > (best?.length ?? 0)) best = value
  }
  return best
}

/**
 * Read the prompt sections a package registers from its resolved entry.
 * A literal or fully-resolvable template is static; a function-valued `text`
 * is reported as runtime-dependent instead of guessing one of its strings.
 * @param source - the package entry source.
 * @param config - the row's declared config.
 * @returns `{ name, orderName?, text?, runtimeDependent }` entries.
 */
export function scanGuidance(source, config) {
  if (typeof source !== 'string' || source === '') return []
  const out = []
  const marker = 'systemPrompt.section('
  for (let at = source.indexOf(marker); at >= 0; at = source.indexOf(marker, at + 1)) {
    if (!isCodeIndex(source, at)) continue
    const open = source.indexOf('{', at)
    if (open < 0) continue
    const end = matchBlock(source, open)
    if (end < 0) continue
    const body = source.slice(open + 1, end)
    const name = resolveExpression(propertyExpression(body, 'name'), { config, source })
    if (name === undefined) continue
    const textExpression = propertyExpression(body, 'text')
    let text = resolveExpression(textExpression, { config, source })
    let runtimeDependent = text === undefined
    if (textExpression !== undefined && textExpression.kind === 'other') {
      // Function-valued text: keep the longest long literal as a clearly
      // marked template hint; the real value is still produced at runtime.
      const textAt = body.search(/\btext\s*:/)
      const hint = textAt < 0 ? undefined : longestString(body.slice(textAt), { config, source })
      if (hint !== undefined && hint.length >= 30) {
        text = hint
        runtimeDependent = true
      } else {
        text = undefined
        runtimeDependent = true
      }
    }
    const order = /\bgetSectionOrder\(\s*["'`]([A-Z0-9_]+)["'`]\s*\)/.exec(body)
    out.push({
      name,
      ...(order === null ? {} : { orderName: order[1] }),
      ...(text === undefined ? { runtimeDependent } : { text, runtimeDependent }),
    })
  }
  return out
}
