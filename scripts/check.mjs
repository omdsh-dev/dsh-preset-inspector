#!/usr/bin/env node
/**
 * Package-contract and i18n gate. Runs before the unit tests:
 *  - manifest entry/icon/bundle/client point at real files;
 *  - the bundle patch inserts this package under its own name;
 *  - the official packages stay host-provided (no dependency fields);
 *  - locale/*.json carries both languages;
 *  - the client dictionary is key- and placeholder-complete, and no Chinese
 *    UI string lives outside it.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { matchBlock } from '../lib/scan.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (file) => readFileSync(join(root, file), 'utf8')
const pkg = JSON.parse(read('package.json'))

assert.equal(pkg.type, 'module')
assert.ok(existsSync(join(root, pkg.main)), 'main entry exists')
assert.equal(pkg.exports['.'], './' + pkg.main)
assert.ok(existsSync(join(root, pkg.icon)), 'icon exists')
assert.ok(existsSync(join(root, pkg.dsh.bundle.patch)), 'bundle patch exists')
assert.ok(existsSync(join(root, pkg.exports['./client'])), 'client entry exists')
assert.equal(pkg.dsh.client.platform, 'web')
assert.equal(pkg.dependencies, undefined, 'official packages are host-provided')
assert.equal(pkg.peerDependencies, undefined, 'official packages are host-provided')
assert.equal(pkg.devDependencies, undefined, 'official packages are host-provided')
for (const file of ['lib/client.js', 'lib/scan.mjs', 'lib/report.mjs', 'lib/provenance.mjs', 'LICENSE', 'icon.svg', 'cordis.patch.yml']) {
  assert.ok(pkg.files.includes(file), `files includes ${file}`)
}

assert.equal(pkg.exports['./package.json'], './package.json', 'package.json is exported')
for (const file of ['README.md', 'LICENSE', 'icon.svg', 'CHANGELOG.md', 'docs/engineering-notes.md', 'docs/preview/model-input.png']) {
  assert.ok(pkg.files.some((entry) => entry === file || (entry.includes('*') && file.startsWith(entry.split('*')[0]))), `files includes ${file}`)
}
const iconPath = join(root, pkg.icon)
const iconStat = statSync(iconPath)
assert.ok(iconStat.size <= 256 * 1024, 'icon is <=256 KiB')
const iconReal = realpathSync(iconPath)
assert.ok(iconReal.startsWith(realpathSync(root) + sep), 'icon realpath stays inside the package')
const icon = readFileSync(iconPath, 'utf8')
assert.equal(/<script/i.test(icon), false, 'icon has no script')
assert.equal(/(?:href|src)\s*=\s*["']https?:/i.test(icon), false, 'icon has no remote resource')
assert.equal(/currentColor/.test(icon), false, 'icon does not depend on currentColor')

const patch = read('cordis.patch.yml')
const insert = patch.match(/- id:\s*([^\s]+)\s*\n\s*name:\s*([^\s#]+)/)
assert.ok(insert, 'bundle patch has an insert row')
assert.equal(insert[2].replace(/^['"]|['"]$/g, ''), pkg.name, 'insert row names this package')

for (const lang of ['en', 'zh']) {
  const meta = JSON.parse(read(`locale/${lang}.json`))
  assert.ok(typeof meta.meta?.title === 'string' && meta.meta.title !== '', `locale/${lang} title`)
  assert.ok(typeof meta.meta?.description === 'string' && meta.meta.description !== '', `locale/${lang} description`)
}

const client = read('lib/client.js')
const at = client.indexOf('const DICTS = ')
assert.ok(at > 0, 'client exposes the dictionary')
const open = client.indexOf('{', at)
const end = matchBlock(client, open)
const dicts = new Function(`return (${client.slice(open, end + 1)})`)()
const zh = Object.keys(dicts.zh).sort()
const en = Object.keys(dicts.en).sort()
assert.deepEqual(zh, en, 'zh/en dictionary keys match')
for (const key of zh) {
  assert.match(key, /^[a-z0-9]+(\.[a-zA-Z0-9]+)+$/, `dictionary key ${key} is dotted lowercase`)
  assert.ok(dicts.zh[key] !== '' && dicts.en[key] !== '', `dictionary key ${key} is non-empty`)
  const placeholders = (value) => [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',')
  assert.equal(placeholders(dicts.zh[key]), placeholders(dicts.en[key]), `placeholders match for ${key}`)
}
const outside = client.slice(end + 1)
assert.equal(/[\u4e00-\u9fff]/.test(outside), false, 'no Chinese UI copy outside the dictionary')


const textFiles = ['index.mjs', 'README.md', 'CHANGELOG.md', 'docs/engineering-notes.md', 'lib/client.js', 'lib/scan.mjs', 'lib/report.mjs', 'lib/provenance.mjs', 'scripts/check.mjs']
for (const file of textFiles) {
  const body = read(file)
  assert.equal(/\/Users\/|\/home\/runner\//.test(body), false, `no machine absolute path in ${file}`)
}

console.log(`preset-inspector check: ${zh.length} dictionary keys, manifest and bundle contract OK`)
