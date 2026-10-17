# 2026-10-17: mount assembly as truth, and a rollback dry-run Agent

## Problem

The probe read `systemPrompt.layers.merge(probe.ctx, ...)`, passing a Cordis
`Context` where `ScopedLayers` expects an opaque **scope key**. `chainLayers`
therefore found no ancestor layers and saw only the global deployment: preset
sections and tools looked missing, so the panel filled the gap with static
source scanning. The same mistake made `tools` discovery appear impossible
without a session.

## Decision

- Pass `scopeOf(probe.ctx)` to every scoped read (`layers.merge`,
  `systemPrompt.assemble({ scope })`, `tools.schemas(scope)`).
- Treat the real `systemPrompt.assemble({ scope })` result as the mount-time
  source of truth: it applies complete-section rules, evaluates function text
  for this scope, and obtains the exact model-facing tool schemas from the tool
  providers. Static scan is now a fallback used only when assembly is
  unavailable, and its rows are labeled accordingly.
- Keep static owner maps for attribution only (package names), not for tool or
  section definitions.
- Add `POST /api/preset-inspector/dryrun`: create an unpublished Agent with
  `agents.create`, mount the requested preset in its setup callback, capture
  `tools.schemas(scope)` + `systemPrompt.assemble({ scope, agent })`, then throw
  a sentinel. The factory's setup rollback closes the unmaterialized session.
- Run the dry-run automatically once per selected preset after mount paints.
  Mechanism labels, capture buttons, and mount-vs-agent diffs are not rendered:
  users see one result. A failed capture keeps the mount result silently (a
  console warning remains for developers); the route stays available for
  scripted checks.

## Evidence

In isolated `0.2.1-rc.1`:

- `standard`: 30 runtime tools, 20 assembled sections, 6 contexts; static scan
  reported 32 tools.
- `minimal`: 3 runtime tools, 1 complete persona section.
- `dryrun` for `standard`: 30 tools, 20 sections, 6 contexts; no new session
  file (session file count unchanged), and the panel showed 30 tools / 17
  rendered sections / 6 contexts with no mount-vs-agent diff for that preset.
- `systemPrompt.assemble({ scope: probeScope })` and `tools.schemas(scope)`
  agreed on the 30 tools.

## Consequences

- Mount-time truth is exact for scoped registrations, including preset
  sections and tool schemas, without a session.
- Agent-time additions still require an Agent. The automatic dry-run covers
  setup without publishing a session on the tested backend; a future DSH
  change to session materialization must revalidate that.
- Because the capture is invisible, the UI never claims which mechanism produced
  a row. Provenance that remains visible is user-facing (deployment/preset,
  package, layer), not the discovery mechanism.
- A preset with an assembly error now shows a warning and falls back to
  registered definitions + per-section probe evaluation.
- Tool rows carry `sourceKind` (`assembly`, `mount`, `agent`, `static`) and the
  drawer exposes an Evidence field; static rows remain clearly marked.
