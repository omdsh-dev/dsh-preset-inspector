# 2026-10-17: remove the sidebar footer entry

## Problem

The inspector was reachable from two places: an icon in the sidebar footer and
an “Inspect” button on every official Agent presets settings card. Once the
settings entry existed, the footer icon was redundant: it duplicated the entry
for the same action, occupied the narrow footer rail next to the host's own
Settings control, and plugins that add permanent chrome there do not match the
host's idiom.

## Decision

- Remove the `sidebar.footer.action` registration and its trigger button.
- Mount the client half as a single `shell.overlay` list entry
  (`preset-inspector`). It renders nothing unless a settings card dispatches
  `preset-inspector:open`, and it owns the settings-card decoration and the
  open event listener for the whole frame lifetime.
- Keep the official Settings → Agent presets card as the only entry. The panel
  still lets the user switch presets after it opens, so the removed button did
  not unlock any panel capability.

## Consequences

- The sidebar footer contains only host controls; the plugin adds no permanent
  chrome.
- There is no fallback surface: if the official card markup changes, the
  “Inspect” decoration stops matching and the plugin becomes temporarily
  unreachable until the selector is updated. This is recorded in the README
  limitations instead of being papered over with a second entry.
- The overlay entry is frame-scoped and survives main-panel navigation; the
  dialog portals above the settings sheet and restores focus to the card
  button on close.
