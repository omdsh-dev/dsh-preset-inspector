# 2026-10-17: UI hierarchy and noise reduction

## Problem

The panel had three stacked toolbars (title, preset pills, preset meta bar,
document header) and repeated low-value text: the tab label was repeated as a
document title, the preset name repeated in the pill and meta bar, hints
explained the panel instead of the content, a type legend repeated the color
bars, every tool row carried a package badge, and every section reserved an
empty metadata line. The result was a flat, noisy page with no clear scan path.

## Decision

- Collapse the header to one brand row: title + profile, view tabs, reload,
  close. Remove the second subtitle line and the separate preset meta bar.
- Move `Show sources` and `Copy rendered text` into the System Prompt section
  header. Section counts sit next to the section title.
- Remove the type legend. Insert a sparse uppercase group label only when the
  section type changes; the label is the hierarchy, the colored rule is the
  cue, and metadata remains available through `Show sources`.
- Render section metadata only when `Show sources` is enabled. No reserved
  blank line, no hover popover.
- Hide repeated `tool` badges and insert-layer `L1` chips in the Harness tree;
  keep category badges for non-default categories and layer chips for actual
  patches. Show the preset id and declaring layer in one muted line.
- Compact the Layers hint to one sentence; keep the cards.
- Tool rows become a dense table: name, one-line description; package appears
  only with `Show sources`. The tool filter is a compact 240px control.
- Context rows keep name, required/optional, and show `preset` only for
  preset-owned exceptions; deployment is the implicit default.

## Consequences

- Content starts roughly 170px higher; the Model view reads as one document,
  with identity/persona/tool-guidance groups instead of a flat block list.
- Repeated package and layer badges no longer dominate the Harness tree.
- Provenance is opt-in via `Show sources`, not ambient noise.
- The UI is denser per row but has fewer competing labels; mobile still wraps
  the section actions and uses a full-width tool filter.


## Follow-up

- Rename the faces to user-facing outcomes: **Model input / Plugin tree / Patch layers** (模型输入 / 插件树 / 补丁层).
- Rename the copy action to **Copy all** / 全文复制; the omission count remains in its title.
- Make each Dynamic context row a button; its drawer shows order, visibility, origin, and trigger rule.
