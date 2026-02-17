# UX Reference

## Information, Not Data
Every displayed value needs context: a range, trend, comparison, or target. A number alone is clutter. If a user can't tell whether a value is good or bad at a glance, add the context that makes it obvious. Prefer inline sparklines and mini-indicators over standalone numbers.

## Visual Hierarchy
Design four levels: **Overview** (KPIs, health, top alerts — answers "is everything OK?"), **Workspace** (routine actions for one subsystem — where most interaction happens), **Detail** (drill-down for investigation), **Diagnostic** (logs, raw data, docs). Design the workspace level first; derive the overview from it. The overview should reflect user goals, not system architecture.

## Progressive Disclosure
Show only what's needed for the current task. Defer advanced/rare options to secondary surfaces (expandable sections, modals, sub-pages). Every drill-down must be reversible. Labels on progressive elements must set clear expectations about what's inside.

## Color Discipline
- Backgrounds: neutral gray or muted tones, not pure white or black for dense interfaces.
- Reserve saturated color exclusively for semantic states: error, warning, success, info, interactive. If red means error, red appears nowhere else.
- Never use color as the sole differentiator — always pair with shape, icon, text, or position (color-blindness affects ~8% of male users).
- Structural elements (borders, dividers, containers): neutral/gray, differentiated by weight not hue.
- When the system is healthy, the screen should be mostly colorless.

## Alerts & Notifications
Three severity tiers with distinct visual treatments (color + icon + label). Alert colors are sacred — used only for alerts. Distinguish acknowledged vs. unacknowledged states visually. One-click from any alert to the context where the user can act. Batch related alerts rather than firing individually. Suppressed/snoozed alerts leave a visible indicator. Never require acknowledging the same alert in two places. During high-volume events, allow temporary muting of lowest priority with auto-timeout.

## Trends & Trajectory
Embed trends wherever a value changes over time and the rate/direction matters. Default Y-axis to a tight range around the operating region, not full-scale. Default time window to the data's natural cadence. Show target/threshold lines on the trend. Use sparklines inline with metrics in tables and lists. Never require multi-step setup to see a trend — if the metric is displayed, its trend should already be there.

## Cognitive Load
- Recognition over recall: show options, don't require memorized identifiers. Users should never type an internal ID to navigate.
- Static labels and units: low contrast. Dynamic values: higher contrast.
- Reduce precision to what's actionable (2 decimals, not 5; seconds, not milliseconds).
- No decorative animation. Reserve motion for communicating state changes.
- If a frequent action takes many clicks, embed it. Users won't perform important-but-buried actions.

## Interaction Principles
- Every action produces visible feedback. Click → visual change. Submit → confirmation or error. Process → progress indicator.
- Controls map spatially to their effects where possible.
- Constraints prevent errors at the source (disabled buttons on incomplete forms, input masks, impossible-date graying).
- Destructive actions require confirmation; the safe option is the default. Consider what an accidental Enter keypress would do on every screen.
- Undo is the most important recovery mechanism.

## Error Handling
Error messages: specific, constructive, blame-free. State what's wrong, where, and what to do about it. When multiple errors exist, prioritize and show a count. Link each error to the field/context where it's resolvable. Never just "Invalid input" — say why and what's expected.

## Performance & Loading
Load structural content first, data-heavy elements (charts, lists) progressively. Show skeleton placeholders, not blank screens. Match update/refresh rates to the actual rate of meaningful change — don't poll every 100ms for data that changes hourly. Target <1s for interactive feedback, <3s for full view loads.

## Consistency
Codify color, typography, spacing, component states, notification tiers, chart conventions, and animation policy in a shared style guide or design-token system. Every new screen uses the system; nothing is ad-hoc. Inertia is real — get the system right early because migration costs compound.

## Checklist: Before Shipping a View
- [ ] Can the user tell if things are OK or not within 1 second?
- [ ] Does every number have context (range, trend, comparison, target)?
- [ ] Are alert/status colors used exclusively for their semantic meaning?
- [ ] Can the user get from any alert to its resolution context in one click?
- [ ] Are destructive actions behind a confirmation with a safe default?
- [ ] Does the view work without color as the sole differentiator?
- [ ] Are frequent actions reachable without multi-step navigation?
- [ ] Does feedback appear for every user action?
- [ ] Are error messages specific and constructive?
- [ ] Does the loading state show structure, not a blank screen?
