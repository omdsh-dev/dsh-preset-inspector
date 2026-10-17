# 2026-10-17: per-row provenance, honest tool inventory, and modal behavior

## Problem

Three independent issues made the inspector look more complete than it was:

1. Provenance stopped at the preset row. Nested plugin rows had no trail, and the
   drawer reused the preset's declaring layer as every child's “source layer”.
2. Tools and prompt sections were attributed to a probe mount, but a probe bound
   to a preset revision only sees deployment root-scope registrations: rows inside
   isolate groups register under an Agent context. The old “runtime tools” result
   was therefore empty, and the static scanner missed official patterns
   (`tool-workflow`'s template name, subagent `config.toolName`, plan-mode).
3. The dialog claimed `aria-modal` without moving focus, trapping Tab, inerting
   the background, or offering a way out of the crash fallback.

## Decision

- Compose child snapshots per layer and diff them by stable path; expose
  `trail` / `sourceLayer` on every node and show before/after for the last patch.
- Prefer a testable static scanner (`lib/scan.mjs`) for declared packages, and
  stop claiming a runtime tool table the probe cannot observe. Root-scope
  deployment sections still come from the probe; tool sections are attributed to
  their declaring package.
- Use the live `agentPresets.defaultId` and `list()` diagnostics for the default
  badge and broken presets; surface skipped bundles and the layer stack.
- Implement real modal behavior (initial focus, focus trap, background inert,
  scroll lock, focus restore) and a closable crash fallback.
- Move all UI copy into a registered zh/en dictionary; add a gate that enforces
  key parity, placeholders, and no Chinese outside the dictionary.
- Attribute known deployment sections to their owning packages via
  `DEPLOYMENT_SOURCES`; drop the redundant “static text” drawer field because
  the runtime badge and runtime-only list already carry that information.

## Alternatives considered

- **Read tools from the probe** — rejected: requires creating a real Agent or a
  private preset tree accessor; static scan is accurate for official declarations
  and the limitation is now stated in the README.
- **Keep one continuous prompt document** — rejected: provenance was invisible;
  section headers, source chips, and color bands now make it inspectable.
- **Reuse official UI primitives** — not available in this 0.2.1-rc.1 install
  tree; the dialog is self-rendered, so it owns focus/ARIA behavior.

## Consequences

- Static scan can over-report conditionally registered tools (for example
  `list_subagent_models` on a fork row) and cannot see custom runtime-built names;
  `## 已知限制` states this.
- Local-directory install remains unsupported (`link:` breaks official package
  resolution); README now only documents tarball/git installation.
- `node scripts/check.mjs` and `node --test` guard the scanner, provenance diff,
  dictionary, and package contract.
