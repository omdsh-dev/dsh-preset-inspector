# Changelog

## 0.20.0

- Remove the sidebar-footer entry button. The official Agent presets settings
  card is now the only entry; the panel mounts in `shell.overlay` and renders
  nothing while closed.

## 0.19.1

- Remove the hardcoded “provider returns text” trigger claim from context details.
- Context drawers now show only observed assembly fields (order, visibility, origin) and state that the provider owns the trigger condition.

## 0.19.0

- Add an Inspect action to official Agent presets settings cards.
- Make Dynamic context rows open a detail drawer.
- Rename views to Model input / Plugin tree / Patch layers.
- Rename copy action to “Copy all” / “全文复制”.

## 0.18.0

- UI hierarchy pass: single brand header, section headers with actions, type group labels, compact tool table and context rows.
- Remove mechanism labels, capture buttons, evidence chips, duplicated preset metadata and long hints.

## 0.16.0

- Use the real mount assembly (`systemPrompt.assemble` + `tools.schemas`) as the primary model-input truth.
- Add an automatic Agent setup capture (dry-run) with silent fallback.
- Add provenance resolution roots and config-replace semantics.
