# 2026-10-17: review fixes — provenance roots, honest copy, and mobile/a11y

## Problem

A review of the 0.14.7 panel found four classes of issues:

1. Provenance conflated the inserting layer with the last patching layer.
   `declaredBy` / `sourceLayer` took `trail.at(-1)`, and the child-package
   resolution root used the last layer's `packageDir`. A preset patched by a
   profile/home layer therefore lost its package identities, versions, and
   static tool scans (profile roots cannot resolve the official packages).
2. `sourceCache` lived for the process, so Reload after a package edit reused
   stale entry text. The Layers view also called a whole-config replacement a
   partial `config` patch.
3. The model view hid provenance behind an overlapping hover pseudo-element;
   switching faces reused the previous scroll offset; opening the drawer did not
   move focus; and 390px headers collapsed the title to zero width.
4. Small metadata text used `label-caption` at 10.5–13px (measured 2.13–3.71:1),
   and “Copy system prompt” included static hints that are not runtime text.

## Decision

- Move composition to `lib/provenance.mjs`. Expose both `introducedBy` (first
  `insert`) and `lastChangedBy` (last step), and build resolution roots from
  every layer that touched the preset or one of its children. Roots are
  per-preset; the shared `requireFrom` array is gone. Removal steps are kept in
  the trail and stale rows are dropped from the final report.
- Clear the per-request source cache at the start of `buildReport`. Relabel a
  loader `config` patch as `replace config`; the copy states that it replaces
  the whole config.
- Add a “Show sources” toggle (hover tooltip remains), reset scroll on face or
  preset change, focus the drawer and restore the trigger, and lay the header
  out in two rows at ≤560px.
- Raise informational small text to `label-secondary`, exclude static hints and
  runtime-only sections from copy, and show the omitted count.
- Localize category badges, add a tool filter, render ordered Markdown lists as
  `<ol>`, and remove the dead `normalizeTool` / `schemaParameters` helpers.
- Harden the static scanner: skip regex literals, ignore marker text in comments
  and strings, and read `required` at property depth zero.
- Add provenance and scanner regression tests, plus LICENSE and package metadata.

## Alternatives considered

- **Keep `sourceLayer` as “last changed”** — rejected: the field and README say
  “declaring layer”; both values are useful, so expose them separately.
- **Resolve packages from the profile only** — rejected: official packages are
  host-provided and do not resolve from the isolated profile root.
- **Make provenance always visible** — rejected as a default: it adds a line to
  every passage; a toggle keeps the clean reading mode.
- **Use a floating hover pseudo-element with `top:-19px`** — rejected: it
  overlapped the legend/first paragraph and had no collision handling.
- **Copy every displayed string** — rejected: static hints are not the real
  request-time text; copying them would misrepresent the prompt.

## Consequences

- A preset patched by a later layer keeps its package metadata and shows both
  “from” and “last changed”.
- `config` replacement is explicit; users must inspect before/after for values.
- Static scanning still cannot see runtime-built tool names; README keeps that
  limitation.
- The panel now has a source toggle, a tool filter, and two-row mobile header;
  desktop density is unchanged except for the extra actions row.
- Tests cover pure provenance composition and scanner comment/regex/depth cases;
  the host probe and browser interactions still rely on the scripted Playwright
  verification (not part of `node --test`).
