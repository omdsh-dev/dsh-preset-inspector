import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchBlock, parametersOf, scanGuidance, scanTools } from '../lib/scan.mjs'

test('matchBlock ignores braces in strings, template literals, and comments', () => {
  const source = '{ a: "}", b: `x ${ "{" } `, /* } */ c: { d: 1 } }'
  assert.equal(matchBlock(source, 0), source.length - 1)
})

test('scanTools reads literal and config-derived names', () => {
  const source = `
    ctx.tools.register(defineTool({
      name: toolName,
      description: "Does a thing",
      parameters: {
        file_path: { type: "string", required: true, description: "Path to read" },
      },
    }))
    ctx.tools.register(defineTool({ name: "second", description: "Two", parameters: {} }))
  `
  const tools = scanTools(source, { toolName: 'dynamic' })
  assert.deepEqual(tools.map((tool) => tool.name), ['dynamic', 'second'])
  assert.equal(tools[0].parameters[0].name, 'file_path')
  assert.equal(tools[0].parameters[0].required, true)
})

test('scanTools resolves a schemastery default when config is silent', () => {
  const source = `
    const Config = z.object({ toolName: z.string().default("solo") })
    ctx.tools.register(defineTool({ name: toolName, description: "S", parameters: {} }))
  `
  assert.deepEqual(scanTools(source, null).map((tool) => tool.name), ['solo'])
})

test('parametersOf does not stop at a brace inside a description', () => {
  const body = `{
    parameters: {
      script: { type: "string", required: true, description: "Use { braces } and \\"quotes\\" safely" },
    }
  }`
  const parameters = parametersOf(body, { config: undefined, source: '' })
  assert.equal(parameters.length, 1)
  assert.match(parameters[0].description, /\{ braces \}/)
})

test('scanGuidance resolves template names and text from config', () => {
  const source = `
    ctx.systemPrompt.section({
      name: \`tool:\${toolName}\`,
      order: ctx.systemPrompt.getSectionOrder("TOOL_WORKFLOW"),
      text: \`Use the \${toolName} tool.\`,
    })
  `
  const guidance = scanGuidance(source, { toolName: 'workflow' })
  assert.equal(guidance[0].name, 'tool:workflow')
  assert.equal(guidance[0].text, 'Use the workflow tool.')
  assert.equal(guidance[0].orderName, 'TOOL_WORKFLOW')
  assert.equal(guidance[0].runtimeDependent, false)
})

test('scanGuidance marks function text as runtime and keeps a hint', () => {
  const source = `
    ctx.systemPrompt.section({
      name: "tool:read",
      text: ({ scope }) => ctx.tools.get("read", scope) === undefined ? "" : "Use the read tool to inspect files without cat.",
    })
  `
  const [guidance] = scanGuidance(source, null)
  assert.equal(guidance.runtimeDependent, true)
  assert.match(guidance.text, /Use the read tool/)
})

test('scanGuidance keeps a genuinely dynamic function without inventing text', () => {
  const source = `
    ctx.systemPrompt.section({
      name: "tool:goal",
      text: (context) => guidance(context.blocked),
    })
  `
  const [guidance] = scanGuidance(source, null)
  assert.equal(guidance.runtimeDependent, true)
  assert.equal(guidance.text, undefined)
})

test('scanGuidance rejects a code fragment as a function text hint', () => {
  const source = `
    ctx.systemPrompt.section({
      name: "tool:subagent",
      text: (context) => {
        return "Start independent delegations => visible.map(name).join(\" or \") together."
      },
    })
  `
  const [guidance] = scanGuidance(source, null)
  assert.equal(guidance.runtimeDependent, true)
  assert.equal(guidance.text, undefined)
})

test('matchBlock ignores braces inside regex literals', () => {
  const source = '{ pattern: /[{}]/, nested: { value: 1 } }'
  assert.equal(matchBlock(source, 0), source.length - 1)
})

test('scanTools ignores a commented-out registration', () => {
  const source = `
    // ctx.tools.register(defineTool({ name: "commented", parameters: {} }))
    ctx.tools.register(defineTool({ name: "real", parameters: {} }))
  `
  assert.deepEqual(scanTools(source, null).map((tool) => tool.name), ['real'])
})

test('scanGuidance ignores a commented-out section', () => {
  const source = `
    // ctx.systemPrompt.section({ name: "commented", text: "No" })
    ctx.systemPrompt.section({ name: "real", text: "Yes" })
  `
  assert.deepEqual(scanGuidance(source, null).map((entry) => entry.name), ['real'])
})

test('parametersOf does not inherit a nested required flag', () => {
  const body = `{
    parameters: {
      outer: { type: "object", properties: { inner: { type: "string", required: true } } },
    }
  }`
  const parameters = parametersOf(body, { config: undefined, source: '' })
  assert.equal(parameters.length, 1)
  assert.equal(parameters[0].name, 'outer')
  assert.equal(parameters[0].required, false)
})
