# Engineering notes

Internal implementation and verification notes for `dsh-preset-inspector`.
User-facing behavior lives in [README](../README.md).

## Data sources

| Route | Purpose |
|---|---|
| `POST /api/preset-inspector/data` | Layer stack + ops, preset plugin trees, per-row trail, categories, static tools |
| `POST /api/preset-inspector/assemble` | Bind a probe scope to the retained preset revision; call `systemPrompt.assemble({ scope })` and `tools.schemas(scope)` |
| `POST /api/preset-inspector/dryrun` | Create an unpublished Agent, mount the preset in its setup callback, capture Agent-scope values, then throw a sentinel to roll back |

### Mount introspection

`ScopedLayers` expects a scope **key**, not a Cordis `Context`. The probe uses
`scopeOf(probe.ctx)` for `layers.merge`, `systemPrompt.assemble`, and
`tools.schemas`. Passing the context object silently reads only the global
layer, which is why earlier versions relied on static scanning.

The real `systemPrompt.assemble({ scope })` result is authoritative for
mount-time sections, tools, and contexts. Static scan is fallback only; it is
not mixed with assembly rows.

### Dry-run

`agents.create` does not bind a preset by itself (the API session controller's
`composeAgent` does). The setup callback calls `presets.mount(agentCtx, id)`
first, captures `tools.schemas(scope)` + `assemble({ scope, agent })`, then
throws. On `0.2.1-rc.1` the factory closes the unmaterialized session and does
not publish it; session file count stayed unchanged in the isolated instance.
This relies on factory rollback semantics; re-validate on upgrade.

The dry-run is automatic once per selected preset in the Model input face.
Failures keep the mount result and log a console warning; mechanism labels are
not shown in the UI.

### Settings card entry

The official Agent presets settings section exposes a `settings.section` slot,
not a per-card action slot in `0.2.1`. The client decorates
`li[data-agent-preset-id]` cards with an “Inspect” button and dispatches
`preset-inspector:open`. A MutationObserver re-applies the decoration after
React renders. This is a temporary bridge until an upstream card-action slot
exists; it is the plugin's only entry point by design.

### Overlay host

The client registers one `shell.overlay` list entry (`preset-inspector`) and
renders nothing while closed. That entry owns the open event listener, the
settings-card decoration, and the portaled dialog, so no persistent sidebar
button is needed. The frame-wide overlay layer is click-through; entries opt
back in, and the panel portals to `document.body` when react-dom is present.

## Verification evidence

Isolated `DSH_HOME` on dsh `0.2.1-rc.1`:

- mount assembly `standard`: 30 tools / 20 sections / 6 contexts; static scan
  reported 32 tools.
- `minimal`: 3 tools / 1 complete persona section.
- dry-run `standard`: 30 tools / 20 sections / 6 contexts; no new session file.
- Settings page: 4 cards → 4 “Inspect” buttons; clicking minimal opens the
  inspector with minimal selected.
- 0.20.0 removal: sidebar footer exposes no inspector button (`.dpi-trigger`
  count 0); the 4 settings cards keep 4 “Inspect” buttons; clicking standard
  opens the panel with standard selected; closing it returns focus to the
  card button; no console or page errors.
- Light/dark themes, Chinese/English, 390px width, keyboard focus and drawer
  focus restore verified.
- `node scripts/check.mjs`: package contract + dictionary parity.
- `node --test`: provenance/scan/report tests.

## Release checks (0.19.1)

- **Icon**: `package.json` top-level `icon` points at `icon.svg` (<256 KiB,
  self-contained SVG). The installed package was loaded in an isolated profile;
  the Plugins page rendered the 36×36 data-image with `naturalWidth > 0`.
  Visual check in the real Plugins list is in `docs/preview/plugins-page.png`.
- **Negative control**: a deliberately broken copy whose `apply()` throws was
  installed in a separate `DSH_HOME`; startup printed `warning: 1 entry did not
  activate` with the exact error. A clean boot is therefore meaningful evidence.
- **UI**: light and dark themes checked; CSS uses only theme tokens (no literal
  colors or private dark palette). 390px width has no horizontal overflow.
- **Gate**: `node scripts/check.mjs` validates the package contract, icon
  constraints, locale parity, dictionary parity, and no-machine-path hygiene;
  `node --test` covers provenance, scanning, and report helpers.
- **Pack**: `pnpm pack` tarball was installed into an isolated profile and the
  panel, Settings card entry, context drawer, and mount/dry-run routes were
  exercised.
