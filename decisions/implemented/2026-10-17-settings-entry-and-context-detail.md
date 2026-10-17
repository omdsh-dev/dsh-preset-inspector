# 2026-10-17: settings card entry and clickable context rows

## Problem

The inspector was only reachable from the sidebar footer. Users browsing
Settings → Agent presets had to remember the preset and reopen the inspector
elsewhere. Separately, Dynamic context rows were static labels: order, required,
and origin were visible, but there was no way to inspect a slot's trigger rule.

## Decision

- Inject a small “Inspect” button into every official preset card foot
  (`li[data-agent-preset-id]`), styled with the panel tokens. The button
  dispatches `preset-inspector:open` with the card's preset id; the footer
  trigger owns the panel and listens for that event.
- The injection is a re-applied DOM decoration. `0.2.1` exposes no per-card
  settings slot; a MutationObserver re-adds the button after React renders.
  The sidebar entry remains the supported fallback if the official markup
  changes.
- Make each Dynamic context row a button. Its drawer shows order, visibility,
  origin, and the generic trigger rule, plus a note that the provider owns the
  real condition and is not executed by this view.

## Consequences

- A preset can be inspected directly from the settings card that describes it.
- The injected button is intentionally outside React; it is re-added on
  re-render and its text updates on locale change, but it can be lost if the
  official card structure changes. This is documented as a temporary bridge
  until an upstream card-action slot exists.
- Context slots are now inspectable without confusing them with prompt
  sections; the drawer reuses the existing drawer focus/restore behavior.
