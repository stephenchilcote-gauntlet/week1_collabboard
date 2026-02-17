# UNITS.md — Unit Map for CollabBoard MVP

Each top-level section maps to one MVP hard-gate requirement from the project spec.
Stories use "I should…" / "When I…" format. "I" = the end user unless stated otherwise.

UX principles from ux-principles-web-apps.md are applied throughout. Key drivers:
- **Norman's 6**: affordances, signifiers, mapping, constraints, feedback, conceptual model
- **Pre-attentive processing**: reserve saturated color for data/state, neutral chrome
- **Situation awareness**: perception of change, comprehension of who/what, projection
- **SRK**: skill-mode interactions (drag, pan) must be spatially consistent with large targets
- **Cognitive load**: recognition over recall, embed info, no IDs in UI

### Implementation Order (dependencies flow top→bottom)
1. **Auth (§8)** — UID/name required by everything below
2. **Board surface + pan/zoom (§1)** — coordinate system required by cursors and object placement
3. **Selection model (§3)** — backbone for delete, resize, color change
4. **Cursor sync (§6)** + **Presence (§7)** — depends on auth + coordinate system
5. **Object CRUD + sync (§4, §5)** — depends on selection + coordinate system
6. **Sticky Notes (§4a)** + **Rectangles (§4b)** — specific object types
7. **Cross-cutting polish (§C)** — toolbar, color UI, error states, loading
8. **Deploy (§9)**

### Scope Decisions
- **AI Agent**: Explicitly post-MVP. See STORIES_BACKLOG.md. Not in this unit map.
- **Multi-tab**: Same user opening multiple tabs is not supported. Second tab overwrites first tab's cursor/presence. Closing one tab may ghost the other's presence (mitigated by TTL heartbeat).

---

## Testing Strategy

### Tools
- **Test runner:** Vitest (already configured in `vite.config.js`)
- **Component testing:** `@testing-library/react` + `jsdom` (already installed)
- **Property-based testing:** `@fast-check/vitest` — PBT with shrinking + seed replay, native `test.prop()` syntax
- **Mutation testing:** `@stryker-mutator/vitest-runner` — verifies tests actually catch errors, HTML reports

### When to use property-based testing
PBT is used instead of (or in addition to) example-based tests wherever an invariant is an **algebraic law over arbitrary inputs**. A handful of golden-vector examples are kept as human-readable documentation, but the real coverage comes from PBT generators. Units marked with **Testing: PBT** below use `@fast-check/vitest`.

### PBT-eligible units (summary)
| Unit | Property |
|------|----------|
| 1-B-1, 1-B-2 | `screenToBoard(boardToScreen(b, pan, zoom)) ≈ b` (round-trip) |
| 1-B-3 | `boardToScreen(viewportCenter(pan, zoom, w, h)) ≈ (w/2, h/2)` |
| 1-A-3 | Pan is additive: `pan(dx1) then pan(dx2) === pan(dx1+dx2)` |
| 1-A-5 | Zoom anchoring: board point under cursor is invariant across zoom |
| 2-B-4 | `sqrt(dx²+dy²) < 5 → click` and `≥ 5 → drag` (binary partition) |
| 2-C-2 | `∀ delta: resultWidth ≥ 20 ∧ resultHeight ≥ 20`; opposite edge fixed |
| 3-B-2 | Handle screen size ≈ 8px at any zoom ∈ [0.1, 3.0] |
| 4-B-1 | All generated IDs unique; all match `/^[^.#$\[\]]+$/` |
| 4-C-1, 4-C-2 | `fn` called at most `⌈duration/interval⌉+1` times; trailing always fires |
| 6-C-1 | Deterministic; hue avoids [195°,225°] and [345°,15°] |
| C-C-1, C-C-2 | `SELECTION_COLOR ∉ OBJECT_COLORS`; no error colors in palette |

### Mutation testing workflow
After tests pass, run `npx stryker run` to verify test quality. Target: no surviving mutants in `src/utils/` (pure functions). Components and hooks may have lower kill rates due to DOM/Firebase mocking boundaries — that's acceptable.

---

## Coordinate System Contract

All units that touch positions must follow this contract:

**Canonical transform:** `screen = (board + pan) * zoom`
- `panX`, `panY` are stored in **board units**
- `zoom` is a scalar (1.0 = 100%)
- **Transform origin:** top-left corner of board container (`0, 0`)
- **Mouse inputs:** Always use `clientX`/`clientY` minus `boardContainer.getBoundingClientRect().left/top` to get container-relative screen coordinates. Never use raw `screenX`/`screenY` (breaks with multi-monitor, page scroll, container offset).

**Forward:** `screenX = (boardX + panX) * zoom`, `screenY = (boardY + panY) * zoom`
**Inverse:** `boardX = screenX / zoom - panX`, `boardY = screenY / zoom - panY`

**Pan delta** (during drag): `panX += dx_screen / zoom`, `panY += dy_screen / zoom` (where `dx_screen = clientX - lastClientX`)

**Zoom anchoring** (keep cursor's board point fixed): Given cursor at `(cx, cy)` in container-relative screen coords, the board point under cursor is `bx = cx / oldZoom - panX`. After zoom: `newPanX = cx / newZoom - bx`, so `newPanX = cx / newZoom - (cx / oldZoom - panX)`.

**Example vectors** (documentation; real coverage via PBT — see Testing Strategy):
- `zoom=2, pan=(100,50)`: `board(0,0) → screen(200,100)`, `screen(200,100) → board(0,0)`
- `zoom=0.5, pan=(-50,-50)`: `board(100,100) → screen(25,25)`, `screen(25,25) → board(100,100)`
- `zoom=1, pan=(0,0)`: `board(x,y) → screen(x,y)` (identity)

**PBT properties** (tested via `@fast-check/vitest`):
- `∀ (bx, by, panX, panY, zoom ∈ [0.1, 3.0]): screenToBoard(boardToScreen(bx, by, pan, zoom), pan, zoom) ≈ (bx, by)` within ε=0.001
- `∀ (sx, sy, panX, panY, zoom ∈ [0.1, 3.0]): boardToScreen(screenToBoard(sx, sy, pan, zoom), pan, zoom) ≈ (sx, sy)` within ε=0.001
- `∀ (panX, panY, zoom, w, h): boardToScreen(viewportCenter(pan, zoom, w, h), pan, zoom) ≈ (w/2, h/2)` within ε=0.001

---

## Interaction State Machine

The board is always in exactly one of these states:

```
States: idle | panning | draggingObject | resizingObject | editingText

Transitions:
  idle → panning:        pointerdown on empty canvas, primary button, not editing
  idle → draggingObject:  pointerdown on object body (not handle), ≥5px movement
  idle → resizingObject:  pointerdown on resize handle
  idle → editingText:     dblclick on sticky note
  panning → idle:         pointerup | pointercancel | window blur | Escape
  draggingObject → idle:  pointerup | pointercancel | window blur | Escape
  resizingObject → idle:  pointerup | pointercancel | window blur | Escape
  editingText → idle:     blur | Escape | click outside

Guards:
  - panning requires: NOT on an object, NOT editing
  - dragging requires: on an object body, NOT editing, NOT on a resize handle
  - resizing requires: on a resize handle, object is selected
  - editing requires: dblclick on a sticky note
  - Escape from any non-idle state → idle (cancel current interaction)
  - While editingText: Ctrl+wheel zoom is BLOCKED (keyboard scoped to text)
  - Pointer capture: on drag/pan start, call setPointerCapture(pointerId);
    release on end. This prevents stuck-drag when mouse leaves window.
```

**Invariant:** At any given moment, exactly one state is active. Starting a new interaction first exits the current state cleanly. The state machine is the single source of truth for what the board is doing.

---

## Unit Tree Overview

```
src/
├── firebase/
│   └── config.js                    # Firebase init (app, db, auth, provider)
├── hooks/
│   ├── useViewport.js               # Pan/zoom state machine
│   ├── useInteractionState.js       # Board interaction state machine
│   ├── useSelection.js              # Selection state
│   ├── useBoardObjects.js           # CRUD + Firebase sync for objects
│   ├── useDrag.js                   # Object drag interaction
│   ├── useResize.js                 # Object resize interaction
│   ├── useCursors.js                # Multiplayer cursor sync
│   └── usePresence.js               # Presence tracking
├── components/
│   ├── Board.jsx                    # Infinite canvas + coordinate transforms
│   ├── StickyNote.jsx               # Sticky note rendering + inline edit
│   ├── Rectangle.jsx                # Rectangle rendering + resize handles
│   ├── SelectionOverlay.jsx         # Selection indicator (border + handles)
│   ├── Toolbar.jsx                  # Action toolbar (create, color, delete)
│   ├── ColorPalette.jsx             # Color picker swatches
│   ├── PresenceBar.jsx              # Who's online display
│   ├── CursorOverlay.jsx            # Remote cursor rendering
│   ├── ConnectionStatus.jsx         # Offline/online banner
│   └── ErrorBanner.jsx              # Error display for failed operations
├── utils/
│   ├── coordinates.js               # Screen↔board coordinate math
│   ├── colors.js                    # Palette, cursor color derivation
│   ├── throttle.js                  # Write throttling for drag/cursor
│   └── ids.js                       # Object ID generation
├── App.jsx                          # Root: auth gate + board composition
└── main.jsx                         # Entry point
```

---

## §0. Entry Point — `src/main.jsx`

### Unit 0-A: `src/main.jsx` — React mount

| Field | Value |
|-------|-------|
| **Stories** | All |
| **Prerequisites** | `index.html` has `<div id="root">` |
| **Invariant** | `createRoot(document.getElementById('root')).render(<App />)` mounts the App into the `#root` DOM element |
| **Plan** | Already implemented. |

---

## §8. Auth — `src/App.jsx`, `src/firebase/config.js`

### User Stories
- 8.1: I should be able to sign in using Google Sign-In with a single button click.
- 8.2: When I am not signed in, I should see only the sign-in screen.
- 8.3: I should be able to sign out via a clearly visible button.
- 8.4: When I close my browser and reopen the app, I should still be signed in.
- 8.5: My display name from Google should be used as my cursor label and presence name.

---

### Unit 8-A: `src/firebase/config.js` — Firebase initialization

| Field | Value |
|-------|-------|
| **Stories** | 8.1, 8.4, 8.5 |
| **Prerequisites** | `.env` with valid Firebase config vars |
| **Exports** | `app`, `db`, `auth`, `googleProvider` |

#### Unit 8-A-1: `initializeApp(firebaseConfig)` — App singleton

| Field | Value |
|-------|-------|
| **Input** | `firebaseConfig` object from `import.meta.env.VITE_FIREBASE_*` |
| **Output** | Firebase App instance |
| **Invariant** | Exactly one Firebase App instance is created per page load; all env vars are read from `import.meta.env`, never hardcoded |
| **Constraints** | Must run before any `getDatabase`/`getAuth` call |
| **Plan** | Already implemented. Validate env vars present in test. |

#### Unit 8-A-2: `db` — Database reference

| Field | Value |
|-------|-------|
| **Input** | Firebase App instance |
| **Output** | `Database` reference |
| **Invariant** | `db` is a valid Realtime Database handle connected to the project's `databaseURL` |
| **Constraints** | None |
| **Plan** | Already implemented. |

#### Unit 8-A-3: `auth` — Auth instance

| Field | Value |
|-------|-------|
| **Input** | Firebase App instance |
| **Output** | `Auth` instance with `browserLocalPersistence` (Firebase default) |
| **Invariant** | Auth persistence is `LOCAL` — user stays signed in across browser restarts |
| **Constraints** | None |
| **Plan** | Already implemented. Firebase default is local persistence. |

#### Unit 8-A-4: `googleProvider` — Google auth provider

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `GoogleAuthProvider` instance |
| **Invariant** | Provider is a `GoogleAuthProvider` that can be passed to `signInWithPopup` |
| **Constraints** | None |
| **Plan** | Already implemented. |

#### Unit 8-A-5: `BOARD_ID` — Board identifier constant

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `'default'` (hardcoded string) |
| **Invariant** | All Firebase paths in the app use this single `BOARD_ID`; all users visiting the same URL share the same board |
| **Constraints** | Story 9.2 — MVP uses single hardcoded board ID |
| **Plan** | `export const BOARD_ID = 'default'`. Used by all hooks that build Firebase refs. |

---

### Unit 8-B: `src/App.jsx` — Auth state machine & gate

| Field | Value |
|-------|-------|
| **Stories** | 8.1, 8.2, 8.3, 8.4 |
| **Prerequisites** | Unit 8-A (Firebase init) |
| **Renders** | Loading screen → Sign-in screen → Board (with sign-out button) |

#### Unit 8-B-1: `App` — Auth state listener

| Field | Value |
|-------|-------|
| **Input** | `onAuthStateChanged` callback |
| **Output** | `{ user, loading }` state |
| **Invariant** | On mount, subscribes to `onAuthStateChanged`; sets `loading=false` after first callback; unsubscribes on unmount; no duplicate listeners after re-render |
| **Constraints** | Must not flash board content before auth state resolves |
| **Plan** | Already implemented. |

#### Unit 8-B-2: `App` — Loading state render

| Field | Value |
|-------|-------|
| **Input** | `loading === true` |
| **Output** | Loading indicator (centered text or spinner) |
| **Invariant** | When `loading` is true, neither sign-in screen nor board is rendered — only a loading indicator |
| **Constraints** | Stories C.3 — never a blank screen during auth check |
| **Plan** | Already implemented as centered "Loading..." text. |

#### Unit 8-B-3: `App` — Sign-in screen render

| Field | Value |
|-------|-------|
| **Input** | `loading === false && user === null` |
| **Output** | Sign-in screen with Google button |
| **Invariant** | When unauthenticated, only the sign-in screen is rendered; board, toolbar, presence, and cursors are not rendered; sign-in button has `cursor: pointer` |
| **Constraints** | Story 8.2 — board not visible or accessible without auth |
| **Plan** | Already implemented. |

#### Unit 8-B-4: `App` — `handleSignIn()`

| Field | Value |
|-------|-------|
| **Input** | Button click |
| **Output** | `signInWithPopup(auth, googleProvider)` called |
| **Invariant** | On success, `onAuthStateChanged` fires with user object containing `uid`, `displayName`, `photoURL`; on failure (popup blocked, network), error is caught and an error message is displayed to the user (not console-only, not a blank screen) |
| **Constraints** | Story 8.1 — single button click; error must not result in blank screen |
| **Plan** | Core call implemented. Add `.catch(err => setError(err.message))` with visible error display. |

#### Unit 8-B-5: `App` — Board render (authenticated)

| Field | Value |
|-------|-------|
| **Input** | `loading === false && user !== null` |
| **Output** | Full board UI: Board, Toolbar, PresenceBar, CursorOverlay, ConnectionStatus, sign-out button |
| **Invariant** | When authenticated, the full board is rendered; CursorOverlay is a sibling to the board container (NOT inside the transformed inner div); user's `displayName` is visible; sign-out button is present and visible with `cursor: pointer` |
| **Constraints** | Story 8.3 — sign-out button clearly visible |
| **Plan** | Scaffold exists. Will compose child components here. CursorOverlay must be outside the board's CSS-transformed layer. |

#### Unit 8-B-6: `App` — `handleSignOut()`

| Field | Value |
|-------|-------|
| **Input** | Button click |
| **Output** | Cleanup then sign-out |
| **Invariant** | On sign-out, the sequence is: (1) remove cursor entry from Firebase, (2) remove presence entry from Firebase, (3) call `signOut(auth)`. Steps 1-2 must complete (or be attempted) before step 3. `onDisconnect` handlers serve as safety net if explicit cleanup fails. On success, `onAuthStateChanged` fires with `null`, rendering reverts to sign-in screen |
| **Constraints** | Story 8.3 — immediate return to sign-in screen |
| **Plan** | `await remove(cursorRef); await remove(presenceRef); await signOut(auth)`. |

---

### Unit 8-C: `database.rules.json` — Security rules

| Field | Value |
|-------|-------|
| **Stories** | 8.2, 9.3 |
| **Prerequisites** | Firebase project configured |
| **Invariant** | Authenticated users (`auth != null`) can read and write all paths under `boards/`. Unauthenticated users cannot read or write anything. Rules are deployed via `firebase deploy`. |
| **Plan** | Already implemented: `"boards": { "$boardId": { ".read": "auth != null", ".write": "auth != null" } }`. |

---

## §1. Infinite Board with Pan/Zoom — `src/components/Board.jsx`, `src/hooks/useViewport.js`, `src/utils/coordinates.js`

### User Stories
- 1.1: Pan by click+drag on empty canvas space; no jitter, no drift, infinite in all directions.
- 1.2: Zoom via Ctrl+scroll centered on cursor; 10%–300% range; independent per user.
- 1.3: Toolbar/chrome stays fixed; pan/zoom resets on refresh.
- 1.4: Light neutral gray background; subtle dot grid or no grid.
- 1.5: 60 FPS target with up to 500 objects; hard gate: 5 users, 100 objects smooth.

---

### Unit 1-A: `src/hooks/useViewport.js` — Viewport state machine

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 1.2, 1.3 |
| **Prerequisites** | None (pure state logic) |
| **Exports** | `useViewport(boardRef)` hook — accepts board container ref for event attachment and dimension tracking |

#### Unit 1-A-1: `useViewport` — Initial state

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `{ panX: 0, panY: 0, zoom: 1 }` |
| **Invariant** | Initial viewport is centered at origin (0,0) with zoom = 1 (100%); state resets on page refresh (no persistence) |
| **Constraints** | Story 1.3 — viewport state is ephemeral |
| **Plan** | `useState` with `{ panX: 0, panY: 0, zoom: 1 }`. |

#### Unit 1-A-2: `useViewport` — `handlePanStart(containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | `pointerdown` event on empty canvas: container-relative coordinates `{ containerX, containerY }` (computed as `clientX - boardRect.left`) |
| **Output** | Sets `isPanning = true`, records `panAnchor = { x: containerX, y: containerY }`, calls `setPointerCapture(pointerId)` |
| **Invariant** | Panning only starts when pointerdown is on empty canvas (not on an object, not on a resize handle, not on an overlay element); `isPanning` flag is set atomically; pointer capture prevents stuck-drag on mouse-leave-window |
| **Constraints** | Story 4.1 — must not conflict with object drag; determined by checking `event.target.closest('[data-object-id]')` returns null AND `event.target.closest('[data-resize-handle]')` returns null |
| **Plan** | Check event target via data attributes. If empty canvas → enter pan mode + pointer capture. |

#### Unit 1-A-3: `useViewport` — `handlePanMove(containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | `pointermove` event while `isPanning === true`: `{ containerX, containerY }` |
| **Output** | Updated `{ panX, panY }` |
| **Invariant** | Pan delta in board units: `panX += (containerX - anchorX) / zoom`, `panY += (containerY - anchorY) / zoom`. Anchor resets to current position each frame. Board pans in the direction of drag with no inertia. Objects maintain relative positions. Follows Coordinate System Contract: `pan` is stored in board units, so screen deltas are divided by zoom |
| **Constraints** | Story 1.1 — no jitter, no rubber-banding, no boundaries; Story 1.5 — must not block frame rendering |
| **Testing** | **PBT**: `∀ (dx1, dy1, dx2, dy2, zoom): pan(dx1) then pan(dx2) === pan(dx1+dx2, dy1+dy2)` (additivity). `∀ (dx, dy, zoom): pan(dx,dy) then pan(-dx,-dy) → original state` (reversibility) |
| **Plan** | `dx = containerX - anchorX; panX += dx / zoom; anchorX = containerX`. Same for Y. |

#### Unit 1-A-4: `useViewport` — `handlePanEnd()`

| Field | Value |
|-------|-------|
| **Input** | `pointerup`, `pointercancel`, or `window blur` event while `isPanning === true` |
| **Output** | `isPanning = false`, releases pointer capture |
| **Invariant** | Board stops moving immediately — no inertia, no drift; `isPanning` resets to false; pointer capture is released |
| **Constraints** | Story 1.1 — no drift after release; clean end on mouse-leaves-window |
| **Plan** | Listen for `pointerup`, `pointercancel` on captured element, and `blur` on window. Release pointer capture. |

#### Unit 1-A-5: `useViewport` — `handleZoom(deltaY, containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | `wheel` event with `ctrlKey === true`: `{ deltaY, containerX, containerY }` (container-relative) |
| **Output** | Updated `{ zoom, panX, panY }` — zoom centered on cursor position |
| **Invariant** | `newZoom = clamp(oldZoom * (deltaY > 0 ? 0.95 : 1.05), 0.1, 3.0)`. The board point under the cursor stays fixed: `boardX = containerX / oldZoom - panX` → `newPanX = containerX / newZoom - boardX`. Follows Coordinate System Contract. |
| **Constraints** | Story 1.2 — cursor-centered zoom; 10%–300% range; no visual corruption |
| **Testing** | **PBT**: `∀ (cx, cy, panX, panY, oldZoom, newZoom ∈ [0.1, 3.0]): screenToBoard(cx, cy, newPan, newZoom) ≈ screenToBoard(cx, cy, oldPan, oldZoom)` — board point under cursor is invariant across zoom transitions |
| **Plan** | Compute board point under cursor, apply new zoom, adjust pan to pin cursor's board point. |

#### Unit 1-A-6: `useViewport` — Wheel event capture

| Field | Value |
|-------|-------|
| **Input** | `wheel` event on board element |
| **Output** | `event.preventDefault()` called; browser page scroll/zoom suppressed |
| **Invariant** | All wheel events on the board element are captured and `preventDefault()` is called. Ctrl+wheel → zoom. Bare wheel (no Ctrl) → no-op (pan is only via click+drag). Listener uses `{ passive: false }` to ensure `preventDefault` works. |
| **Constraints** | Story 1.1 — browser page must not scroll/zoom when interacting with board |
| **Plan** | `useEffect` to attach non-passive wheel listener to board ref. |

#### Unit 1-A-7: `useViewport` — Zoom display value

| Field | Value |
|-------|-------|
| **Input** | `zoom` state |
| **Output** | `zoomPercent = Math.round(zoom * 100)` |
| **Invariant** | Current zoom level is available as a rounded percentage string (e.g., "75%") for display |
| **Constraints** | Story 1.2 — user must see current zoom level |
| **Plan** | Derived value, computed inline. |

#### Unit 1-A-8: `useViewport` — Viewport dimensions tracking

| Field | Value |
|-------|-------|
| **Input** | `boardRef.current.clientWidth`, `boardRef.current.clientHeight`, window `resize` event |
| **Output** | `{ viewportWidth, viewportHeight }` |
| **Invariant** | Viewport dimensions reflect the board container's current pixel size; update on window resize |
| **Constraints** | Required by `viewportCenter()` for object creation placement |
| **Plan** | Read `clientWidth`/`clientHeight` from board ref. Listen for `resize` event to update. |

---

### Unit 1-B: `src/utils/coordinates.js` — Coordinate transforms

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 1.2, 6.2 |
| **Prerequisites** | None (pure math) |
| **Exports** | `screenToBoard`, `boardToScreen`, `viewportCenter` |

#### Unit 1-B-1: `screenToBoard(screenX, screenY, panX, panY, zoom)` → `{ x, y }`

| Field | Value |
|-------|-------|
| **Input** | Container-relative screen-space pixel coordinates + viewport state |
| **Output** | Board-space coordinates |
| **Invariant** | `boardX = screenX / zoom - panX`, `boardY = screenY / zoom - panY`. Round-trips with `boardToScreen` within ±0.001. All inputs are container-relative (not raw clientX). Pure function, no side effects. |
| **Constraints** | Used by cursor sync, object creation, hit testing |
| **Testing** | **PBT**: `∀ (bx, by, panX, panY, zoom ∈ [0.1, 3.0]): screenToBoard(boardToScreen(bx, by, pan, zoom), pan, zoom).x ≈ bx` (and y). Example vectors kept as docs. |
| **Plan** | Pure function. |

#### Unit 1-B-2: `boardToScreen(boardX, boardY, panX, panY, zoom)` → `{ x, y }`

| Field | Value |
|-------|-------|
| **Input** | Board-space coordinates + viewport state |
| **Output** | Container-relative screen-space pixel coordinates |
| **Invariant** | `screenX = (boardX + panX) * zoom`, `screenY = (boardY + panY) * zoom`. Inverse of `screenToBoard`. Pure function. |
| **Constraints** | Pure function |
| **Testing** | **PBT**: `∀ (sx, sy, panX, panY, zoom ∈ [0.1, 3.0]): boardToScreen(screenToBoard(sx, sy, pan, zoom), pan, zoom).x ≈ sx` (and y). |
| **Plan** | Pure function. |

#### Unit 1-B-3: `viewportCenter(panX, panY, zoom, viewportWidth, viewportHeight)` → `{ x, y }`

| Field | Value |
|-------|-------|
| **Input** | Viewport state + container dimensions |
| **Output** | Board-space coordinates of viewport center |
| **Invariant** | Returns the board point at the center of the visible screen: `screenToBoard(viewportWidth / 2, viewportHeight / 2, panX, panY, zoom)`. An object created at this position renders at the visual center of the screen. |
| **Constraints** | Pure function |
| **Testing** | **PBT**: `∀ (panX, panY, zoom ∈ [0.1, 3.0], w ∈ [100, 3000], h ∈ [100, 2000]): boardToScreen(viewportCenter(pan, zoom, w, h), pan, zoom) ≈ (w/2, h/2)` within ε=0.001 |
| **Plan** | `screenToBoard(viewportWidth / 2, viewportHeight / 2, panX, panY, zoom)`. |

---

### Unit 1-C: `src/components/Board.jsx` — Canvas surface & event routing

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 1.2, 1.3, 1.4, 1.5 |
| **Prerequisites** | Units 1-A (useViewport), 1-B (coordinates) |
| **Props** | `{ user }` |
| **Renders** | Outer container (fixed, captures events) → inner transformed layer (pans/zooms) → children (objects) |

#### Unit 1-C-1: `Board` — DOM structure

| Field | Value |
|-------|-------|
| **Input** | Viewport state from `useViewport` |
| **Output** | Outer `div` (viewport: `overflow: hidden`, `position: relative`, `width: 100%`, `height: 100%`, ref attached) containing inner `div` (board layer: CSS `transform: scale(${zoom}) translate(${panX}px, ${panY}px)`, `transform-origin: 0 0`) |
| **Invariant** | Outer div is the event capture surface and clips content to screen. Inner div applies the single CSS transform that positions all board content. `transform-origin: 0 0`. CursorOverlay is rendered OUTSIDE this component (as a sibling in App.jsx), not inside the transformed inner div — cursors use `boardToScreen()` for positioning and do not inherit the board's CSS transform. Background is `#f0f0f0` (light neutral gray). |
| **Constraints** | Story 1.3 — toolbar/chrome is outside this div, stays fixed; Story 1.4 — light neutral gray background |
| **Plan** | Two nested divs. Outer: `position: relative; overflow: hidden; width: 100%; height: 100%; background: #f0f0f0`. Inner: `transform: scale(${zoom}) translate(${panX}px, ${panY}px); transform-origin: 0 0`. |

#### Unit 1-C-2: `Board` — Dot grid background

| Field | Value |
|-------|-------|
| **Input** | Viewport state |
| **Output** | CSS `background-image` radial-gradient dot pattern on inner div |
| **Invariant** | Dots are very low contrast (`rgba(0,0,0,0.06)`), spaced at regular intervals, and move with pan/zoom (applied to inner transformed div) |
| **Constraints** | Story 1.4 — structural, not data; very low contrast |
| **Plan** | CSS `background-image: radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px); background-size: 20px 20px` on inner div. |

#### Unit 1-C-3: `Board` — Event delegation: pointerdown routing

| Field | Value |
|-------|-------|
| **Input** | `pointerdown` event on board |
| **Output** | Routes to either `handlePanStart` (empty space) or `handleObjectPointerDown` (object hit) |
| **Invariant** | Hit-testing uses `event.target.closest('[data-object-id]')`. If found → object interaction (select + potential drag). If null → pan. When objects overlap, the topmost (highest CSS `z-index`) object wins the click because DOM stacking order determines `event.target`. Only primary button (`button === 0`) starts interactions. |
| **Constraints** | Story 4.1 — unambiguous distinction between drag and pan; Story 4.5 — topmost object wins click |
| **Plan** | Objects set `data-object-id` attribute. On pointerdown, check `event.target.closest('[data-object-id]')` and `event.target.closest('[data-resize-handle]')`. Route accordingly. |

#### Unit 1-C-4: `Board` — Event delegation: wheel routing

| Field | Value |
|-------|-------|
| **Input** | `wheel` event on board |
| **Output** | If `ctrlKey` → `handleZoom(deltaY, containerX, containerY)`; always `preventDefault()` |
| **Invariant** | Ctrl+wheel zooms; bare wheel is captured (no browser scroll) but is a no-op; `{ passive: false }` ensures `preventDefault` works; containerX/Y computed as `clientX - boardRect.left` |
| **Constraints** | Story 1.1 — no browser page scroll; Story 1.2 — Ctrl+scroll zooms |
| **Plan** | `useEffect` to attach non-passive wheel listener to board ref. |

#### Unit 1-C-5: `Board` — Stuck-interaction prevention

| Field | Value |
|-------|-------|
| **Input** | `pointerup`, `pointercancel` outside window; `window blur` |
| **Output** | All active interactions (pan, drag, resize) terminate cleanly |
| **Invariant** | If pointer exits browser window during pan/drag/resize, interaction ends at last known position; no ghost interaction state persists. Pointer capture (set on interaction start) ensures `pointerup` fires on the capturing element even if pointer leaves window. `window blur` is a fallback safety net. |
| **Constraints** | Stories 1.1, 4.1 — no stuck-drag state |
| **Plan** | Pointer capture handles most cases. Global `window blur` listener clears all interaction flags as fallback. |

#### Unit 1-C-6: `Board` — Board objects loading state

| Field | Value |
|-------|-------|
| **Input** | `objectsLoaded` boolean from `useBoardObjects` |
| **Output** | Loading indicator shown until first `onValue` callback fires |
| **Invariant** | Board shows a loading indicator (spinner or skeleton) until the initial Firebase object data arrives. Does not flash an empty board followed by objects popping in. After `objectsLoaded = true`, objects render and loading indicator disappears. If the board has no objects, an empty board is shown (no error, no "no objects found"). |
| **Constraints** | Story C.3 — no blank-then-pop-in; no error on empty board |
| **Plan** | Track `objectsLoaded` flag in `useBoardObjects`. Set true after first `onValue`. Board renders loading indicator while false. |

---

## §2. Interaction Hooks — `src/hooks/useInteractionState.js`, `src/hooks/useDrag.js`, `src/hooks/useResize.js`

### Unit 2-A: `src/hooks/useInteractionState.js` — Interaction state machine

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 4.1, 3.3, 2.2 |
| **Prerequisites** | None (pure state logic) |
| **Exports** | `useInteractionState()` hook |

#### Unit 2-A-1: `useInteractionState` — State and transitions

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `{ mode, setMode, activeObjectId }` where `mode` ∈ `{ 'idle', 'panning', 'dragging', 'resizing', 'editing' }` |
| **Invariant** | Only one mode is active at a time. `setMode('dragging', objectId)` sets `mode = 'dragging'` and `activeObjectId = objectId`. `setMode('idle')` clears both. Mode transitions follow the state machine guards defined above. |
| **Constraints** | See Interaction State Machine section above |
| **Plan** | `useState('idle')` for mode, `useState(null)` for activeObjectId. |

---

### Unit 2-B: `src/hooks/useDrag.js` — Object drag interaction

| Field | Value |
|-------|-------|
| **Stories** | 4.1, 4.5, 5.2 |
| **Prerequisites** | Unit 1-B (coordinates), Unit 4-A (useBoardObjects) |
| **Exports** | `useDrag(viewport, updateObject)` hook |

#### Unit 2-B-1: `useDrag` — `handleDragStart(objectId, containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | Object ID, container-relative pointer coordinates |
| **Output** | Sets `draggingId = objectId`, records `dragAnchor` (board-space offset from object origin to pointer), brings object to front (`zIndex = maxZ + 1`) |
| **Invariant** | Drag start records the offset between the pointer and the object's origin in board space, so the object doesn't snap to cursor center. Object is immediately brought to front (z-index update). Selection is set to this object. |
| **Constraints** | Story 4.5 — dragged objects render on top; Story 4.1 — no snap on drag start |
| **Plan** | `boardPoint = screenToBoard(containerX, containerY, panX, panY, zoom)`. `offset = { x: boardPoint.x - object.x, y: boardPoint.y - object.y }`. |

#### Unit 2-B-2: `useDrag` — `handleDragMove(containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | Container-relative pointer coordinates while `draggingId !== null` |
| **Output** | Object position updated locally (immediate) + throttled Firebase write |
| **Invariant** | `newX = screenToBoard(containerX, ...).x - offsetX`, `newY = screenToBoard(containerX, ...).y - offsetY`. Local state updated every pointermove frame (60fps). Firebase write throttled to max 20Hz (50ms interval). Drag deltas are computed in board-space (accounting for zoom via `screenToBoard`). Other users see intermediate positions. |
| **Constraints** | Story 4.1 — smooth local, throttled remote |
| **Plan** | Update local position on every move. `throttle(updateObject, 50)` for Firebase. |

#### Unit 2-B-3: `useDrag` — `handleDragEnd()`

| Field | Value |
|-------|-------|
| **Input** | `pointerup` or cancel event |
| **Output** | `draggingId = null`; final position flushed to Firebase |
| **Invariant** | On drag end, the throttled write is flushed (final position guaranteed written). `draggingId` cleared. Object stays at drop position — no snap-back. If total movement was < 5px screen pixels, this was a click (selection only), not a drag — position is not written. |
| **Constraints** | Story 4.1 — stays at drop position; I-9 — click threshold |
| **Plan** | Call `throttle.flush()`. Clear drag state. Check distance threshold. |

#### Unit 2-B-4: `useDrag` — Click threshold (< 5px = select, ≥ 5px = drag)

| Field | Value |
|-------|-------|
| **Input** | Total pointer movement distance from pointerdown to pointerup |
| **Output** | If < 5px → treated as click (select only, no position update). If ≥ 5px → treated as drag. |
| **Invariant** | Distance computed as `sqrt((endX - startX)² + (endY - startY)²)` in screen pixels. Below threshold: only `select(objectId)` is called. Above threshold: drag interaction runs normally. |
| **Constraints** | Story 4.1 — prevents slips; SRK motor error tolerance |
| **Testing** | **PBT**: `∀ (dx, dy) where sqrt(dx²+dy²) < 5: result === 'click'`. `∀ (dx, dy) where sqrt(dx²+dy²) ≥ 5: result === 'drag'`. Binary partition over continuous domain. |
| **Plan** | Track `startContainerX/Y`. Compare on pointerup. |

---

### Unit 2-C: `src/hooks/useResize.js` — Object resize interaction

| Field | Value |
|-------|-------|
| **Stories** | 3.3 |
| **Prerequisites** | Unit 1-B (coordinates), Unit 4-A (useBoardObjects) |
| **Exports** | `useResize(viewport, updateObject)` hook |

#### Unit 2-C-1: `useResize` — `handleResizeStart(objectId, handlePosition, containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | Object ID, handle position (`'nw'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'`), pointer coordinates |
| **Output** | Sets `resizingId`, records initial object bounds and pointer position |
| **Invariant** | Each of the 8 handle positions maps to a resize direction. Top/left handles affect `x`/`y` AND `width`/`height` simultaneously (dragging top handle up increases height AND decreases y). |
| **Constraints** | Story 3.3 — resize handles on selection |
| **Plan** | Record `initialBounds = { x, y, width, height }`, `startPointer`, `handlePos`. |

#### Unit 2-C-2: `useResize` — `handleResizeMove(containerX, containerY)`

| Field | Value |
|-------|-------|
| **Input** | Pointer coordinates while resizing |
| **Output** | Updated object `{ x, y, width, height }` |
| **Invariant** | Delta computed in board space. For top-left handle: `newX = initialX + deltaX`, `newWidth = initialWidth - deltaX`. For bottom-right: `newWidth = initialWidth + deltaX`. Width and height clamped to minimum 20px. If clamped, position adjusts to maintain the fixed edge. Local update is immediate; Firebase write is throttled. |
| **Constraints** | Story 3.3 — smooth, min 20×20px, no flicker |
| **Testing** | **PBT**: `∀ (initialBounds, handlePos ∈ {nw,n,ne,e,se,s,sw,w}, deltaX, deltaY): resultWidth ≥ 20 ∧ resultHeight ≥ 20`. `∀ resize from handle H: the edge opposite H does not move` (e.g., dragging `nw` doesn't move `se` corner). |
| **Plan** | Compute delta in board space. Apply per-handle resize rules. Clamp. Throttled Firebase write. |

#### Unit 2-C-3: `useResize` — `handleResizeEnd()`

| Field | Value |
|-------|-------|
| **Input** | Pointer release |
| **Output** | `resizingId = null`; final dimensions flushed to Firebase |
| **Invariant** | Final dimensions written. Resize state cleared. |
| **Plan** | Flush throttle. Clear state. |

---

## §3. Selection Model — `src/hooks/useSelection.js`, `src/components/SelectionOverlay.jsx`

### User Stories
- 4.4 (from spec): Click object → visible selection indicator; click empty → clear selection; visually obvious at all times.
- 4.5 (from spec): Z-order: topmost object wins click; new objects on top; dragged objects on top.

---

### Unit 3-A: `src/hooks/useSelection.js` — Selection state

| Field | Value |
|-------|-------|
| **Stories** | 4.4, 4.3, C.1a |
| **Prerequisites** | None (pure state) |
| **Exports** | `useSelection(objects, user, presenceList)` hook |

#### Unit 3-A-1: `useSelection` — State shape

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `{ selectedId, select(id), clearSelection() }` |
| **Invariant** | At most one object is selected at a time (single-select MVP); `selectedId` is `null` when nothing is selected |
| **Constraints** | Multi-select is post-MVP |
| **Plan** | `useState(null)` for `selectedId`. |

#### Unit 3-A-2: `useSelection` — `select(objectId)`

| Field | Value |
|-------|-------|
| **Input** | `objectId` (string) |
| **Output** | `selectedId = objectId` |
| **Invariant** | After `select(id)`, `selectedId === id`; replaces any previous selection |
| **Constraints** | None |
| **Plan** | `setSelectedId(objectId)`. |

#### Unit 3-A-3: `useSelection` — `clearSelection()`

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `selectedId = null` |
| **Invariant** | After `clearSelection()`, `selectedId === null` |
| **Constraints** | Story 4.4 — clicking empty space calls this |
| **Plan** | `setSelectedId(null)`. |

#### Unit 3-A-4: `useSelection` — Selection survives object updates

| Field | Value |
|-------|-------|
| **Input** | Object state changes (position, color, text) while selected |
| **Output** | `selectedId` unchanged |
| **Invariant** | Changing an object's properties does not clear its selection; selection persists through moves, edits, and color changes |
| **Constraints** | None |
| **Plan** | Selection stores only ID, not object reference. Object data is independent. |

#### Unit 3-A-5: `useSelection` — Selection cleared on object deletion

| Field | Value |
|-------|-------|
| **Input** | Selected object is deleted (locally or remotely) |
| **Output** | `selectedId = null` |
| **Invariant** | If the object referenced by `selectedId` no longer exists in the objects map, selection auto-clears |
| **Constraints** | Story 5.2 — if selected object is deleted by remote user, selection clears |
| **Plan** | Derive: if `selectedId && !objects[selectedId]`, clear. Effect or inline check in render. |

#### Unit 3-A-6: `useSelection` — Mutual exclusion (remote locking)

| Field | Value |
|-------|-------|
| **Input** | `remoteSelections` from Firebase `boards/{BOARD_ID}/selections`, `user`, `presenceList` |
| **Output** | `lockedObjectIds`: map of `objectId → { uid, name }` for objects selected by other **present** users |
| **Invariant** | A user cannot select an object already selected by another user. `lockedObjectIds` only includes users who appear in `presenceList` (heartbeat-verified present). Stale selection entries from disconnected users are ignored within ~15s (presence TTL). Locked objects appear greyed out (50% opacity, grayscale, `not-allowed` cursor) with a blue name badge. If another user locks the object we currently have selected, our selection auto-clears. |
| **Constraints** | Story 5.2 — conflict prevention; single-select mutual exclusion |
| **Plan** | Subscribe to `boards/{BOARD_ID}/selections` via `onValue`. Compute `lockedObjectIds` by filtering remote selections to only users in `presentUids` set (derived from `presenceList`). `select()` checks `lockedRef.current[objectId]` before allowing selection. |

#### Unit 3-A-7: `useSelection` — Selection sync to Firebase

| Field | Value |
|-------|-------|
| **Input** | `selectedId`, `user` |
| **Output** | Firebase write/remove at `boards/{BOARD_ID}/selections/{uid}` |
| **Invariant** | When `selectedId` is non-null, writes `{ objectId, name }` to Firebase. When null, removes the entry. `onDisconnect().remove()` is registered via `.info/connected` listener (survives reconnections) — set up once per user, not re-registered on every `selectedId` change. On unmount, explicitly removes selection entry. |
| **Constraints** | Story 7.4 — crash cleanup via `onDisconnect`; no permanently locked objects |
| **Plan** | Separate effect for `onDisconnect` registration via `.info/connected`. Separate effect for `set()`/`remove()` on `selectedId` change. Unmount cleanup in the `onDisconnect` effect's teardown. |

---

### Unit 3-B: `src/components/SelectionOverlay.jsx` — Visual selection indicator

| Field | Value |
|-------|-------|
| **Stories** | 4.4, 3.3 |
| **Prerequisites** | Unit 3-A |
| **Props** | `{ object, isRectangle, zoom }` |

#### Unit 3-B-1: `SelectionOverlay` — Border indicator

| Field | Value |
|-------|-------|
| **Input** | Selected object's `{ x, y, width, height }` |
| **Output** | Blue border rendered around the object |
| **Invariant** | Selection border color is `SELECTION_COLOR` (`#2196F3`), never used for object fill colors. Border is visible at all zoom levels. Overlay is `pointer-events: none` except for resize handles (which are `pointer-events: auto`). This ensures clicks pass through the overlay to the object below for event delegation. |
| **Constraints** | Story 4.4 — consistent distinct color not used for fills |
| **Plan** | Absolutely positioned div with `border: 2px solid #2196F3`, `pointer-events: none`, overlaying the object bounds. |

#### Unit 3-B-2: `SelectionOverlay` — Resize handles (rectangles only)

| Field | Value |
|-------|-------|
| **Input** | Selected rectangle's bounds, current `zoom` |
| **Output** | 8 resize handle dots at corners and edge midpoints |
| **Invariant** | Each handle is at least 8×8px in **screen pixels** regardless of zoom. Since handles are rendered inside the board's CSS-transformed layer, their CSS size must be `8 / zoom` px in board units (the CSS transform scales them back to 8 screen px). Handles are only shown for rectangles, not sticky notes. Each handle has `data-resize-handle` attribute with position value (`nw`, `n`, `ne`, etc.) and `pointer-events: auto`. |
| **Constraints** | Story 3.3 — handles ≥ 8×8px screen pixels at any zoom; SRK target sizes |
| **Testing** | **PBT**: `∀ zoom ∈ [0.1, 3.0]: (8 / zoom) * zoom ≈ 8` — confirms board-space size scaled by CSS transform yields ~8 screen px. Verify at extreme zoom (0.1 → board size 80px, 3.0 → board size 2.67px). |
| **Plan** | Render 8 small divs at corner/edge positions. Size: `${8/zoom}px`. `data-resize-handle="nw"` etc. |

---

## §4. Object CRUD + Sync — `src/hooks/useBoardObjects.js`, `src/utils/ids.js`, `src/utils/throttle.js`

### User Stories (from spec §2, §3, §4, §5)
- 4.1: Drag object → follows cursor smoothly; drop → stays; real-time sync of intermediate positions; throttled writes; no stuck-drag.
- 4.2: Edit text, change color.
- 4.3: Delete selected object via Delete/Backspace; nothing selected → no-op.
- 4.5: Z-order: topmost wins click; new on top; dragged on top.
- 5.1: Object CRUD appears near-instantly for other users.
- 5.2: Conflict resolution: last-write-wins; drag local authority; simultaneous text edit last-write-wins.
- 5.3: Resilience: offline edits queue; connectivity indicator; sync on reconnect; board state persists.
- 5.4: 5+ concurrent users, 500+ objects.

---

### Unit 4-A: `src/hooks/useBoardObjects.js` — Board object state & Firebase sync

| Field | Value |
|-------|-------|
| **Stories** | 2.1, 3.1, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3 |
| **Prerequisites** | Unit 8-A (Firebase config), Unit 1-B (coordinates) |
| **Exports** | `useBoardObjects(user)` hook |

#### Unit 4-A-1: `useBoardObjects` — Firebase subscription

| Field | Value |
|-------|-------|
| **Input** | `BOARD_ID` constant |
| **Output** | `objects` map: `{ [id]: { id, type, x, y, width, height, text, color, updatedAt, updatedBy, zIndex } }` + `objectsLoaded` boolean |
| **Invariant** | Objects state stays in sync with `boards/{BOARD_ID}/objects` in Firebase. Remote changes update local state. Listener is unsubscribed on unmount. `objectsLoaded` starts `false`, becomes `true` after first `onValue` callback (even if snapshot is empty). No duplicate listeners after re-render. |
| **Constraints** | Story 5.1 — near-instant sync |
| **Plan** | `onValue` listener on objects ref. Convert snapshot to map. Set `objectsLoaded = true` in first callback. Return unsubscribe in cleanup. |

#### Unit 4-A-2: `useBoardObjects` — `createObject(type, props)`

| Field | Value |
|-------|-------|
| **Input** | `type` ('sticky' or 'rectangle'), `props: { x, y, width, height, text?, color }` |
| **Output** | New object written to Firebase at `boards/{BOARD_ID}/objects/{newId}` |
| **Invariant** | Object appears locally immediately (optimistic: added to local `objects` state before Firebase write completes). Firebase write includes: `id`, `type`, all props, `updatedAt: Date.now()`, `updatedBy: user.uid`, `zIndex: max(existing zIndexes) + 1`. Generated ID is unique (collision-resistant). Every Firebase write to any object path includes `updatedAt` and `updatedBy` — no exceptions. If Firebase write fails, local optimistic state reverts and error is displayed via ErrorBanner. |
| **Constraints** | Story 2.1, 3.1 — immediate appearance; Story 4.5 — new objects on top |
| **Edge cases** | Rapid creation: each click creates exactly one object with a unique `zIndex`. Multiple rapid clicks create stacked objects at viewport center (acceptable — user drags them apart). Concurrent creation by multiple users may produce duplicate `zIndex` values; DOM insertion order resolves ties (acceptable for MVP). |
| **Plan** | Generate UUID via `generateId()`. Compute `zIndex`. Optimistic local update. `set()` to Firebase. `.catch()` → revert local + show error. |

#### Unit 4-A-3: `useBoardObjects` — `updateObject(id, changes)`

| Field | Value |
|-------|-------|
| **Input** | `id` (object ID), `changes` (partial: `{ x?, y?, width?, height?, text?, color?, zIndex? }`) |
| **Output** | Merge update to `boards/{BOARD_ID}/objects/{id}` in Firebase |
| **Invariant** | Only specified fields are updated (merge, not overwrite). `updatedAt: Date.now()` and `updatedBy: user.uid` are always appended to `changes`. Local state updates immediately (optimistic). If Firebase write fails, local state reverts and error is shown. |
| **Constraints** | Story 5.2 — last-write-wins via `updatedAt` |
| **Plan** | `update()` on object ref with `{ ...changes, updatedAt: Date.now(), updatedBy: user.uid }`. `.catch()` → revert + error. |

#### Unit 4-A-4: `useBoardObjects` — `deleteObject(id)`

| Field | Value |
|-------|-------|
| **Input** | `id` (object ID) |
| **Output** | Object removed from `boards/{BOARD_ID}/objects/{id}` in Firebase |
| **Invariant** | Object is removed locally immediately (optimistic). Firebase `remove()` is called. All users see the object disappear. Other objects are unaffected. If Firebase write fails, object is restored locally and error is shown. |
| **Constraints** | Story 4.3 — disappears from all users within 100ms |
| **Plan** | Save object copy for rollback. Optimistic local delete. `remove()` on ref. `.catch()` → restore + error. |

#### Unit 4-A-5: `useBoardObjects` — Drag: local authority during active drag

| Field | Value |
|-------|-------|
| **Input** | Incoming remote update for object currently being dragged locally (`draggingId`) |
| **Output** | Remote update is ignored/buffered for the dragged object's `x`/`y` |
| **Invariant** | While user is actively dragging object X, `objects[X].x` and `objects[X].y` use local position, not Firebase position. Other fields (color, text) from remote updates are still applied. After mouseup, Firebase listener resumes full authority. Last-write-wins reconciles final position. |
| **Constraints** | Story 5.2 — prevents jitter/teleport during drag |
| **Plan** | Track `draggingId` (from useDrag). In `onValue` callback: for `draggingId`, merge remote data but skip `x`/`y`. On drag end, clear `draggingId`. |

#### Unit 4-A-6: `useBoardObjects` — Remote deletion of active object

| Field | Value |
|-------|-------|
| **Input** | Object being edited or dragged is deleted by remote user (disappears from Firebase snapshot) |
| **Output** | Edit mode closes (without attempting to save — object no longer exists); drag cancels; object disappears from local state; selection clears |
| **Invariant** | If a remotely deleted object is currently being edited, the `onUpdate` call is skipped/guarded. If being dragged, drag state resets. No error is thrown. No attempt to write to a deleted object's path. |
| **Constraints** | Story 5.2 — edit/drag of deleted object closes cleanly |
| **Plan** | In Firebase listener, detect removed objects. If removed ID matches editing/dragging state, clear those states. Guard `onUpdate` calls with existence check. |

---

### Unit 4-B: `src/utils/ids.js` — ID generation

| Field | Value |
|-------|-------|
| **Stories** | 2.1, 3.1 |
| **Prerequisites** | None |
| **Exports** | `generateId()` |

#### Unit 4-B-1: `generateId()` → string

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | Unique string ID |
| **Invariant** | Each call returns a unique string. Output is safe for Firebase keys (no `.`, `#`, `$`, `[`, `]`). Collision-resistant for 500+ objects. |
| **Constraints** | Firebase key constraints |
| **Testing** | **PBT**: `∀ batch of 1000 calls: all results unique (Set size === 1000)`. `∀ id: /^[^.#$\[\]]+$/.test(id) === true`. |
| **Plan** | `crypto.randomUUID()`. |

---

### Unit 4-C: `src/utils/throttle.js` — Throttle utility

| Field | Value |
|-------|-------|
| **Stories** | 4.1, 6.2 |
| **Prerequisites** | None |
| **Exports** | `throttle(fn, intervalMs)` |

#### Unit 4-C-1: `throttle(fn, intervalMs)` → throttled function

| Field | Value |
|-------|-------|
| **Input** | Function `fn`, interval in ms |
| **Output** | Wrapped function that calls `fn` at most once per `intervalMs` |
| **Invariant** | First call executes immediately (leading). Subsequent calls within interval are deferred. Trailing call (last invocation after interval expires) is always executed to ensure final state is sent. Returns a function with a `.flush()` method. |
| **Constraints** | Must support trailing call for drag-end and cursor sync to send final position |
| **Testing** | **PBT**: `∀ (call sequences with random timing, interval): fn is called at most ⌈totalDuration/interval⌉ + 1 times`. `∀ sequences: after quiescence, fn was last called with the most recent args` (trailing guarantee). |
| **Plan** | Leading + trailing throttle: track `lastRun` and `pendingArgs`. On call: if enough time elapsed, execute. Otherwise, set timeout for trailing execution. |

#### Unit 4-C-2: `throttle` — `flush()` method

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | Immediately executes pending trailing call if any |
| **Invariant** | After `flush()`, the most recent arguments have been passed to `fn`. Used on pointerup to ensure final position is written. Clears pending timeout. |
| **Constraints** | Must be callable at any time |
| **Plan** | Clear pending timeout, execute with `pendingArgs` if present. |

---

## §4a. Sticky Notes — `src/components/StickyNote.jsx`

### User Stories
- 2.1: Create via toolbar button; appears at viewport center; default yellow; syncs to Firebase.
- 2.2: Double-click for inline text edit; standard shortcuts; Escape exits; text saved on blur; paste strips HTML.
- 2.3: Hover → grab cursor; double-click → text cursor; visually prominent colored rectangles.
- 2.4: Change color from predefined palette; syncs within 100ms.
- 2.5: Fixed width, not user-resizable; text wraps and note expands vertically.

---

### Unit 4a-A: `src/components/StickyNote.jsx` — Sticky note component

| Field | Value |
|-------|-------|
| **Stories** | 2.1, 2.2, 2.3, 2.4, 2.5 |
| **Prerequisites** | Units 1-C (Board), 3-A (Selection), 4-A (useBoardObjects) |
| **Props** | `{ object, isSelected, onSelect, onUpdate, onDragStart, zoom }` |

#### Unit 4a-A-1: `StickyNote` — Render

| Field | Value |
|-------|-------|
| **Input** | `object: { id, x, y, width, height, text, color, zIndex }` |
| **Output** | Colored rectangle div with text content, positioned at `(x, y)` in board space |
| **Invariant** | Visual appearance: colored fill matching `object.color`; text rendered inside; `width` is fixed (e.g., 200px); `minHeight: 150px`; height expands to fit text via `overflow-wrap: break-word` and no `maxHeight`. Looks distinct from Rectangle component (appears as a "paper" note). DOM element has `style.zIndex = object.zIndex` so z-ordering is visually correct. |
| **Constraints** | Story 2.3 — visually prominent; Story 2.5 — fixed width, vertical expansion |
| **Plan** | `div` with `background: object.color`, `width: 200px`, `minHeight: 150px`, `overflow-wrap: break-word`, `zIndex: object.zIndex`. |

#### Unit 4a-A-2: `StickyNote` — Cursor signifiers

| Field | Value |
|-------|-------|
| **Input** | Hover state, edit state |
| **Output** | `cursor: grab` on hover (not editing); `cursor: text` when editing |
| **Invariant** | Default hover shows grab cursor (draggable signifier). During text edit, cursor is text cursor. These are mutually exclusive. `cursor: grabbing` during active drag. |
| **Constraints** | Story 2.3 — signifiers for drag vs. edit; Story C.4 — hover cursor change on all interactive elements |
| **Plan** | CSS `cursor` property toggled by `isEditing` state. |

#### Unit 4a-A-3: `StickyNote` — Double-click enters edit mode

| Field | Value |
|-------|-------|
| **Input** | `dblclick` event on sticky note |
| **Output** | `isEditing = true`; text becomes editable (textarea or contentEditable) |
| **Invariant** | Double-click transitions to edit mode. Single click does not. Edit mode renders an editable text area in-place (no modal, no popup). On entering edit mode, interaction state transitions to `'editing'`. |
| **Constraints** | Story 2.2 — inline editing, no modal |
| **Plan** | `onDoubleClick` → set `isEditing = true` → set interaction state to `'editing'`. Render `<textarea>` when editing. |

#### Unit 4a-A-4: `StickyNote` — Text editing: keyboard scope

| Field | Value |
|-------|-------|
| **Input** | Keyboard events while `isEditing === true` |
| **Output** | Delete/Backspace edits text (not deletes object). Ctrl+A/C/V work. All keyboard events `stopPropagation()`. |
| **Invariant** | While editing, keyboard events are scoped to the text editor — they do not bubble to board-level handlers (Delete → delete object, etc.). Delete/Backspace modifies text content only. Ctrl+wheel zoom is blocked while editing. |
| **Constraints** | Story 2.2 — keyboard scoped to edit context; prevents catastrophic slips |
| **Plan** | `onKeyDown` handler on textarea calls `e.stopPropagation()`. |

#### Unit 4a-A-5: `StickyNote` — Text editing: drag scope

| Field | Value |
|-------|-------|
| **Input** | Pointer drag inside text area while editing |
| **Output** | Text selection (not object move) |
| **Invariant** | While editing, drag gestures inside the text area select text — they do not initiate object move. `pointerdown` inside textarea calls `e.stopPropagation()`. |
| **Constraints** | Story 2.2 — drag context determines behavior |
| **Plan** | `onPointerDown` on textarea: `e.stopPropagation()` when editing. |

#### Unit 4a-A-6: `StickyNote` — Exit edit mode

| Field | Value |
|-------|-------|
| **Input** | Click outside sticky note, Escape key, or blur event |
| **Output** | `isEditing = false`; text saved to Firebase via `onUpdate` |
| **Invariant** | Escape exits edit mode without deleting note. Clicking outside exits edit mode. On exit, current text value is written to Firebase. Already-saved text is not discarded. If text is empty on exit, the object remains with empty text (no auto-delete); the note renders with `minHeight` to remain interactive. Interaction state transitions back to `'idle'`. |
| **Constraints** | Story 2.2 — Escape exits edit, doesn't delete; text saved on blur |
| **Edge cases** | Empty text: object persists with empty string. Object deleted remotely during edit: save is skipped (guard via existence check in `onUpdate`). |
| **Plan** | `onBlur` → save text + set `isEditing = false`. `onKeyDown` Escape → blur the textarea (triggers onBlur). |

#### Unit 4a-A-7: `StickyNote` — Paste plain text only

| Field | Value |
|-------|-------|
| **Input** | `paste` event while editing |
| **Output** | Only plain text inserted; HTML/rich formatting stripped |
| **Invariant** | `event.clipboardData.getData('text/plain')` is used. `event.preventDefault()` prevents default rich paste. |
| **Constraints** | Story 2.2 — paste strips HTML |
| **Plan** | `onPaste` handler: `e.preventDefault()`, get `text/plain`, insert at cursor. |

#### Unit 4a-A-8: `StickyNote` — Text overflow handling

| Field | Value |
|-------|-------|
| **Input** | Text content longer than default height |
| **Output** | Note expands vertically to fit text |
| **Invariant** | Text wraps within fixed width. Note height grows to accommodate all text. Text is never silently clipped. No `maxHeight` or `overflow: hidden` on the text container. |
| **Constraints** | Story 2.2 — text must not be clipped; Story 2.5 — vertical expansion |
| **Plan** | `minHeight` on container, no `maxHeight`, `overflow-wrap: break-word`. |

#### Unit 4a-A-9: `StickyNote` — `data-object-id` attribute

| Field | Value |
|-------|-------|
| **Input** | `object.id` |
| **Output** | `data-object-id={object.id}` on outermost DOM element |
| **Invariant** | Every board object's root DOM element carries `data-object-id` for event delegation hit-testing |
| **Constraints** | Required by Unit 1-C-3 (event routing) |
| **Plan** | Set attribute on root div. |

---

## §4b. Rectangle Shape — `src/components/Rectangle.jsx`

### User Stories
- 3.1: Create via toolbar; default position/size; syncs within 100ms.
- 3.2: Visible fill and/or border; distinguishable from sticky notes; changeable color.
- 3.3: Resize handles on selection; handles ≥ 8×8px; smooth resize; min size 20×20px; syncs real-time.

---

### Unit 4b-A: `src/components/Rectangle.jsx` — Rectangle component

| Field | Value |
|-------|-------|
| **Stories** | 3.1, 3.2, 3.3 |
| **Prerequisites** | Units 1-C (Board), 3-A (Selection), 4-A (useBoardObjects) |
| **Props** | `{ object, isSelected, onSelect, onUpdate, onDragStart, onResizeStart, zoom }` |

#### Unit 4b-A-1: `Rectangle` — Render

| Field | Value |
|-------|-------|
| **Input** | `object: { id, x, y, width, height, color, type: 'rectangle', zIndex }` |
| **Output** | Rectangle div with fill color and border |
| **Invariant** | Has visible fill color (`object.color`) and a 1-2px border (darker shade of fill). Visually distinct from StickyNote (no text, different border style, no "paper" texture). DOM element has `style.zIndex = object.zIndex`. |
| **Constraints** | Story 3.2 — distinguishable from sticky notes |
| **Plan** | `div` with `background: object.color`, `border: 2px solid darken(color)`, `width: object.width`, `height: object.height`, `zIndex: object.zIndex`. |

#### Unit 4b-A-2: `Rectangle` — `data-object-id` attribute

| Field | Value |
|-------|-------|
| **Input** | `object.id` |
| **Output** | `data-object-id={object.id}` on outermost DOM element |
| **Invariant** | Same as Unit 4a-A-9 |
| **Constraints** | Required by Unit 1-C-3 |
| **Plan** | Set attribute on root div. |

---

## §6. Multiplayer Cursors — `src/hooks/useCursors.js`, `src/components/CursorOverlay.jsx`

### User Stories
- 6.1: See other users' cursors with name labels; distinct from my system cursor; deterministic color from UID.
- 6.2: Real-time updates < 50ms perceived; throttled writes; correct board-space position across pan/zoom.
- 6.3: Cursor appears on join; disappears within seconds on leave.

---

### Unit 6-A: `src/hooks/useCursors.js` — Cursor sync

| Field | Value |
|-------|-------|
| **Stories** | 6.1, 6.2, 6.3 |
| **Prerequisites** | Unit 8-A (Firebase config), Unit 1-B (coordinates) |
| **Exports** | `useCursors(user, viewport)` hook |

#### Unit 6-A-1: `useCursors` — Local cursor broadcast

| Field | Value |
|-------|-------|
| **Input** | `pointermove` event on board, viewport state, `user.uid` |
| **Output** | Firebase write to `boards/{BOARD_ID}/cursors/{uid}` with `{ x, y, name, lastActiveAt }` in board-space coordinates |
| **Invariant** | Local cursor position is converted from container-relative screen-space to board-space via `screenToBoard()` before writing. Writes are throttled to max 20Hz (50ms interval). Cursor name is `user.displayName`. `lastActiveAt` is `Date.now()` (client timestamp for TTL expiry). Mouse inputs use `clientX - boardRect.left` for container-relative coordinates. |
| **Constraints** | Story 6.2 — throttled to avoid flooding DB |
| **Plan** | `pointermove` → compute container-relative coords → `screenToBoard()` → throttled `set()` to Firebase. |

#### Unit 6-A-2: `useCursors` — Remote cursor subscription

| Field | Value |
|-------|-------|
| **Input** | Firebase `on('value')` listener on `boards/{BOARD_ID}/cursors` |
| **Output** | `remoteCursors` map: `{ [uid]: { x, y, name, lastActiveAt } }` |
| **Invariant** | Remote cursors exclude the current user's own cursor (`uid !== user.uid`). Cursors with `lastActiveAt` older than 10 seconds are treated as stale and filtered out. Map updates on every Firebase value event. Listener returns unsubscribe function. No duplicate listeners after re-render. |
| **Constraints** | Story 6.1 — don't show own cursor label; Story 6.3 — stale cursors filtered by TTL |
| **Plan** | `onValue` listener, filter out `user.uid`, filter stale entries, store in state. |

#### Unit 6-A-3: `useCursors` — `onDisconnect` cleanup

| Field | Value |
|-------|-------|
| **Input** | `user.uid`, `.info/connected` listener |
| **Output** | `onDisconnect().remove()` registered for `boards/{BOARD_ID}/cursors/{uid}` |
| **Invariant** | When user disconnects (tab close, crash, network loss), Firebase server removes their cursor entry. `onDisconnect` is re-registered every time `.info/connected` transitions to `true` (not just on mount) to survive reconnections. Combined with TTL filtering (Unit 6-A-2), stale cursors disappear within seconds. |
| **Constraints** | Story 6.3 — stale cursors must not linger |
| **Plan** | Listen to `ref(db, '.info/connected')`. On `true`: `set()` cursor data + `onDisconnect().remove()`. |

---

### Unit 6-B: `src/components/CursorOverlay.jsx` — Cursor rendering

| Field | Value |
|-------|-------|
| **Stories** | 6.1, 6.2 |
| **Prerequisites** | Unit 6-A (useCursors), Unit 1-B (coordinates) |
| **Props** | `{ remoteCursors, viewport }` |

#### Unit 6-B-1: `CursorOverlay` — Cursor positioning

| Field | Value |
|-------|-------|
| **Input** | Remote cursor board-space `{ x, y }` + viewport state |
| **Output** | Cursor element positioned in screen-space via `boardToScreen()` |
| **Invariant** | Remote cursors appear at the correct screen position regardless of local pan/zoom. Position updates when viewport changes. CursorOverlay is rendered as a `position: fixed` layer OUTSIDE the board's CSS-transformed container (not inside the scaled inner div). Cursor elements do not inherit the board's CSS transform. |
| **Constraints** | Story 6.2 — correct board-space position across pan/zoom |
| **Plan** | For each cursor: `boardToScreen(cursor.x, cursor.y, panX, panY, zoom)` → CSS `left`/`top`. Render in fixed overlay. |

#### Unit 6-B-2: `CursorOverlay` — Cursor visual

| Field | Value |
|-------|-------|
| **Input** | Cursor `{ name, uid }` |
| **Output** | Colored arrow/triangle + name label |
| **Invariant** | Each cursor has a color derived deterministically from `uid` via `cursorColorFromUid()` (same color across sessions). Name label shows `displayName`. Visually distinct from system cursor (colored, with label). |
| **Constraints** | Story 6.1 — stable color from UID; labeled with name |
| **Plan** | SVG arrow or CSS triangle + text label. Color from `cursorColorFromUid(uid)`. |

#### Unit 6-B-3: `CursorOverlay` — Off-screen cursors

| Field | Value |
|-------|-------|
| **Input** | Cursor screen position outside viewport bounds |
| **Output** | Cursor is not rendered |
| **Invariant** | Cursors with screen position outside `[0, viewportWidth] × [0, viewportHeight]` are hidden. Not rendered at invisible off-screen positions. |
| **Constraints** | Story 6.2 — should disappear when off-screen |
| **Plan** | Check screen position bounds before rendering. |

---

### Unit 6-C: `src/utils/colors.js` — Cursor color derivation

| Field | Value |
|-------|-------|
| **Stories** | 6.1 |
| **Prerequisites** | None (pure function) |
| **Exports** | `cursorColorFromUid(uid)` |

#### Unit 6-C-1: `cursorColorFromUid(uid)` → color string

| Field | Value |
|-------|-------|
| **Input** | User UID string |
| **Output** | HSL color string, e.g., `hsl(217, 70%, 50%)` |
| **Invariant** | Same UID always produces same color. Different UIDs produce visually distinct colors (distributed across hue wheel). Output hue avoids ±15° of 210° (selection blue) and ±15° of 0°/360° (error red). Pure function. |
| **Constraints** | Story 6.1 — stable across sessions; deterministic |
| **Testing** | **PBT**: `∀ uid: cursorColorFromUid(uid) === cursorColorFromUid(uid)` (deterministic). `∀ uid: extractHue(result) ∉ [195°, 225°] ∧ ∉ [345°, 15°]` (forbidden ranges). |
| **Plan** | Hash UID to integer, mod 330 + offset to skip forbidden hue ranges, fixed saturation/lightness. |

---

## §7. Presence Awareness — `src/hooks/usePresence.js`, `src/components/PresenceBar.jsx`

### User Stories
- 7.1: See list of who is online; visible at all times; join within 2s, leave within 5s.
- 7.2: Show display name and Google photo; count overflow ("+3 more").
- 7.3: See myself in presence list with "(You)" label.
- 7.4: Crash cleanup via `onDisconnect`; no ghost entries on refresh.

---

### Unit 7-A: `src/hooks/usePresence.js` — Presence tracking

| Field | Value |
|-------|-------|
| **Stories** | 7.1, 7.3, 7.4 |
| **Prerequisites** | Unit 8-A (Firebase config) |
| **Exports** | `usePresence(user)` hook |

#### Unit 7-A-1: `usePresence` — Register presence on connect

| Field | Value |
|-------|-------|
| **Input** | `user` object `{ uid, displayName, photoURL }`, `.info/connected` listener |
| **Output** | Firebase write to `boards/{BOARD_ID}/presence/{uid}` with `{ uid, name, photoURL, lastActiveAt }` |
| **Invariant** | Presence registration listens to `.info/connected`. On each transition to `true`: (1) write presence entry with `lastActiveAt: Date.now()`, (2) register `onDisconnect().remove()` on same ref. This ensures presence is re-registered after reconnection (when `onDisconnect` would have removed it). `lastActiveAt` is updated periodically (every 5s heartbeat interval) to enable TTL-based presence. Write happens within 1 second of connection. |
| **Constraints** | Story 7.1 — appear within 2s; Story 7.4 — survive reconnection |
| **Plan** | `onValue(ref(db, '.info/connected'), snap => { if (snap.val()) { set(presenceRef, {...}); onDisconnect(presenceRef).remove(); } })`. Heartbeat: `setInterval(() => update(presenceRef, { lastActiveAt: Date.now() }), 5000)`. |

#### Unit 7-A-2: `usePresence` — Subscribe to presence list

| Field | Value |
|-------|-------|
| **Input** | Firebase `on('value')` listener on `boards/{BOARD_ID}/presence` |
| **Output** | `presenceList` array of `{ uid, name, photoURL, lastActiveAt }` objects |
| **Invariant** | List includes users whose `lastActiveAt` is within TTL (15 seconds). Users beyond TTL are filtered out (treated as offline even if entry exists). Updates on every Firebase value event. Includes current user. No duplicate listeners after re-render. |
| **Constraints** | Story 7.3 — current user included; Story 7.1 — leave within 5s (TTL + onDisconnect) |
| **Plan** | `onValue` listener, convert snapshot to array, filter by `Date.now() - lastActiveAt < 15000`. |

#### Unit 7-A-3: `usePresence` — Cleanup on unmount / sign-out

| Field | Value |
|-------|-------|
| **Input** | Component unmount or sign-out |
| **Output** | Presence entry removed from Firebase; heartbeat interval cleared; listener unsubscribed |
| **Invariant** | On clean unmount, presence entry is explicitly `remove()`'d (don't rely only on `onDisconnect`). Heartbeat interval is cleared. Firebase listener is unsubscribed. |
| **Constraints** | Story 8.3 — sign-out removes presence |
| **Plan** | Cleanup function: `remove(presenceRef)`. `clearInterval(heartbeat)`. `off()` listener. |

#### Unit 7-A-4: `usePresence` — Idle timeout (5 minutes)

| Field | Value |
|-------|-------|
| **Input** | User activity events: `pointerdown`, `pointermove`, `keydown`, `wheel`, `touchstart` |
| **Output** | After 5 minutes of inactivity, presence entry is removed and heartbeat stops. User treated as offline. |
| **Invariant** | `lastActivityRef` tracks the timestamp of the most recent user interaction. Each heartbeat tick checks `Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS` (300,000ms). If idle: stops heartbeat, removes presence entry from Firebase (`goIdle()`). On next activity event: re-registers presence and restarts heartbeat (`goOnline()`). This also releases any selection locks the idle user held (via presence-gated `lockedObjectIds` in Unit 3-A-6). |
| **Constraints** | Story 7.1 — presence reflects actual engagement, not just an open tab |
| **Plan** | Activity event listeners on `window` (passive). `lastActivityRef` updated on each event. Heartbeat checks idle threshold. `goIdle()` removes presence + stops heartbeat. `handleActivity()` calls `goOnline()` + restarts heartbeat if currently idle. |

#### Unit 7-A-5: `usePresence` — Tab visibility detection

| Field | Value |
|-------|-------|
| **Input** | `document.visibilitychange` event |
| **Output** | Switching away from the tab immediately removes presence (goes idle). Switching back restores presence. |
| **Invariant** | `document.hidden === true` triggers `goIdle()` immediately (does not wait for 5-minute timeout). `document.hidden === false` triggers `handleActivity()` which calls `goOnline()` and restarts heartbeat. Combined with Unit 7-A-4, this ensures users who switch tabs or minimize the window are promptly treated as offline, releasing their selection locks. |
| **Constraints** | Story 7.1 — fast leave detection for tab switches |
| **Plan** | `document.addEventListener('visibilitychange', ...)`. Check `document.hidden` to call `goIdle()` or `handleActivity()`. Listener removed in cleanup. |

---

### Unit 7-B: `src/components/PresenceBar.jsx` — Presence display

| Field | Value |
|-------|-------|
| **Stories** | 7.1, 7.2, 7.3 |
| **Prerequisites** | Unit 7-A |
| **Props** | `{ presenceList, currentUid }` |

#### Unit 7-B-1: `PresenceBar` — Layout

| Field | Value |
|-------|-------|
| **Input** | `presenceList` array |
| **Output** | Horizontal bar of user avatars with names, fixed position (top of screen) |
| **Invariant** | Presence bar is always visible. Does not overlap with board content interaction areas. Positioned at top edge. Does not move with pan/zoom. |
| **Constraints** | Story 7.1 — visible at all times without interrupting workflow |
| **Plan** | Fixed-position div at top. Flexbox row of avatar elements. |

#### Unit 7-B-2: `PresenceBar` — User avatar entry

| Field | Value |
|-------|-------|
| **Input** | User `{ name, photoURL, uid }` |
| **Output** | Circular avatar image + name text |
| **Invariant** | Shows Google profile photo via `<img src={photoURL}>` if available. Fallback to initial letter of name in a colored circle. Name is displayed. |
| **Constraints** | Story 7.2 — show display name and Google photo |
| **Plan** | `<img>` with `photoURL`, `onError` fallback to letter avatar. |

#### Unit 7-B-3: `PresenceBar` — "(You)" label

| Field | Value |
|-------|-------|
| **Input** | `currentUid`, presence entry |
| **Output** | "(You)" appended to current user's name |
| **Invariant** | The current user's entry is distinguishable. "(You)" label appears only for `uid === currentUid`. |
| **Constraints** | Story 7.3 — visually distinguished own entry |
| **Plan** | Conditional render: `name + (uid === currentUid ? ' (You)' : '')`. |

#### Unit 7-B-4: `PresenceBar` — Overflow count

| Field | Value |
|-------|-------|
| **Input** | `presenceList` with > N entries (N = max visible, e.g. 5) |
| **Output** | "+X more" badge after visible avatars |
| **Invariant** | When presence count exceeds display limit, remaining users are collapsed into a count badge. All users are still tracked, just not all rendered. |
| **Constraints** | Story 7.2 — count overflow |
| **Plan** | Slice list to first N, render overflow count if `list.length > N`. |

---

## §5. Real-Time Sync — cross-cutting (covered by §4 + additional units)

### User Stories
- 5.1: Object CRUD appears near-instantly for other users.
- 5.2: Conflict resolution: last-write-wins; drag local authority; simultaneous text edit last-write-wins.
- 5.3: Resilience: offline edits queue; connectivity indicator; sync on reconnect.
- 5.4: 5+ concurrent users, 500+ objects.

Most sync invariants are covered by Unit 4-A. Below are additional units.

---

### Unit 5-A: `src/components/ConnectionStatus.jsx` — Connectivity indicator

| Field | Value |
|-------|-------|
| **Stories** | 5.3 |
| **Prerequisites** | Unit 8-A (Firebase config) |
| **Props** | None (self-contained) |

#### Unit 5-A-1: `ConnectionStatus` — Firebase connectivity detection

| Field | Value |
|-------|-------|
| **Input** | Firebase `.info/connected` listener |
| **Output** | `isConnected` boolean state |
| **Invariant** | Reflects Firebase WebSocket connection state. Updates within 3 seconds of connectivity change. Listener returns unsubscribe on unmount. |
| **Constraints** | Story 5.3 — visible indicator within 3 seconds |
| **Plan** | `onValue(ref(db, '.info/connected'), snap => setConnected(snap.val()))`. |

#### Unit 5-A-2: `ConnectionStatus` — Offline banner

| Field | Value |
|-------|-------|
| **Input** | `isConnected === false` |
| **Output** | Persistent banner with icon + text: "Connection lost — reconnecting…" |
| **Invariant** | Banner is persistent (does not auto-dismiss). Uses warning color (amber `#F59E0B`) paired with ⚠ icon and text label — never color alone. Positioned at top of screen. Does not block board interaction (`pointer-events: none` or positioned to not overlap interactive areas). |
| **Constraints** | Story 5.3 — persistent banner, not toast; color + icon + text; never color alone |
| **Plan** | Fixed-position div at top. Amber background + ⚠ icon + text. Conditional render on `!isConnected`. |

#### Unit 5-A-3: `ConnectionStatus` — Reconnection feedback

| Field | Value |
|-------|-------|
| **Input** | `isConnected` transitions from `false` to `true` |
| **Output** | Banner disappears |
| **Invariant** | When connectivity is restored, the offline banner disappears. Firebase RTDB automatically replays queued offline writes. |
| **Constraints** | Story 5.3 — confirmation of recovery |
| **Plan** | When `isConnected` becomes true, hide banner. |

---

### Unit 5-B: Remote change perception — visual feedback

| Field | Value |
|-------|-------|
| **Stories** | 5.1, 5.2 |
| **Prerequisites** | Unit 4-A |

#### Unit 5-B-1: Remote object creation indicator

| Field | Value |
|-------|-------|
| **Input** | New object appears in Firebase that was not created locally |
| **Output** | Subtle entrance animation (fade-in or brief highlight) on the new object |
| **Invariant** | Remotely created objects are visually perceptible as new arrivals — not silently appearing in place. Determined by tracking locally-created IDs vs. IDs appearing from Firebase. |
| **Constraints** | Story 5.1 — changes must be detectable (SA Level 1) |
| **Plan** | Track set of locally-created IDs. New IDs from Firebase not in local set → apply `opacity: 0 → 1` CSS transition over 300ms. |

#### Unit 5-B-2: Remote drag name tag

| Field | Value |
|-------|-------|
| **Input** | Object being moved by remote user (rapid position updates with `updatedBy !== currentUser.uid`) |
| **Output** | Brief name tag near the object showing who is moving it |
| **Invariant** | When a remote user is dragging an object (detected by rapid `updatedAt` changes with foreign `updatedBy`), their display name appears as a small label near the object. Label disappears after updates stop (debounced 1 second). |
| **Constraints** | Story 5.2 — comprehension of who is acting (SA Level 2) |
| **Plan** | Detect rapid updates: if `updatedBy !== user.uid` and `Date.now() - updatedAt < 1000`, show name tag. Debounce hide after 1s of no updates. |

#### Unit 5-B-3: Off-screen remote change indicator

| Field | Value |
|-------|-------|
| **Input** | Remote object created/moved to position outside local viewport |
| **Output** | Lightweight non-modal indicator (e.g., "Alice added a sticky note") |
| **Invariant** | Off-screen remote changes produce a brief notification. Check if object's board position is within current viewport by converting to screen coords and checking bounds. If outside, show notification with user name + action. Auto-dismisses after 3 seconds. |
| **Constraints** | Story 5.1 — off-screen changes are otherwise invisible |
| **Plan** | On remote object create/move: `boardToScreen(obj.x, obj.y, ...)`. If outside `[0, viewportW] × [0, viewportH]` → show toast with name. |

---

### Unit 5-C: `src/components/ErrorBanner.jsx` — Error display

| Field | Value |
|-------|-------|
| **Stories** | C.5 |
| **Prerequisites** | None |
| **Props** | `{ message, onDismiss }` |

#### Unit 5-C-1: `ErrorBanner` — Render

| Field | Value |
|-------|-------|
| **Input** | Error message string |
| **Output** | Visible error banner with message text + dismiss button |
| **Invariant** | Error renders visibly at top of screen. Auto-dismisses after 5 seconds or manual dismiss. Never covers critical UI elements. Error uses red/orange accent paired with ✕ icon and text — not color alone. Message is specific and constructive (e.g., "Failed to save sticky note — retrying…"), never blames user, never shows raw error codes. |
| **Constraints** | Story C.5 — specific, constructive, blame-free error messages; color reserved for error states |
| **Plan** | Fixed-position div. Red border/accent. Text + dismiss button. `setTimeout(onDismiss, 5000)`. |

---

## §C. Cross-Cutting Concerns

### User Stories
- C.1: Persistent toolbar with action buttons; recognizable icons + labels/tooltips; neutral gray chrome; fixed position; works at all zoom levels.
- C.1a: Color palette appears when object selected; shows swatches; same for stickies and shapes; current color indicated.
- C.3: Loading states — no blank screen, no empty-then-pop-in.
- C.4: Conceptual model — every interactive element has hover cursor change; every action produces immediate visible result.
- C.5: Error states — Firebase unreachable indicator; optimistic rollback on failure; error messages specific and constructive.

---

### Unit C-A: `src/components/Toolbar.jsx` — Action toolbar

| Field | Value |
|-------|-------|
| **Stories** | C.1, 2.1, 3.1, 4.3 |
| **Prerequisites** | Unit 4-A (useBoardObjects), Unit 3-A (useSelection) |
| **Props** | `{ onCreateSticky, onCreateRectangle, onDeleteSelected, selectedId, selectedObject }` |

#### Unit C-A-1: `Toolbar` — Layout

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | Fixed-position toolbar at left edge of screen |
| **Invariant** | Toolbar is positioned at screen edge (`position: fixed`). Does not move with pan/zoom. Does not obscure primary board interaction area. Background is neutral gray (`#e8e8e8`). Position and layout are identical across interactions and sessions (spatial consistency). All buttons have `cursor: pointer`. |
| **Constraints** | Story C.1 — edge of screen; neutral gray; doesn't obscure content; spatial consistency |
| **Plan** | `position: fixed; left: 0; top: 50%; transform: translateY(-50%)`. Background: `#e8e8e8`. |

#### Unit C-A-2: `Toolbar` — "Sticky Note" button

| Field | Value |
|-------|-------|
| **Input** | Click |
| **Output** | Calls `onCreateSticky()` — creates one sticky note at viewport center |
| **Invariant** | Single click = one sticky note created immediately. Button is labeled with icon + text/tooltip. Button is always visible regardless of zoom. Each click creates exactly one object (no debounce — rapid clicks create multiple objects). |
| **Constraints** | Story C.1 — action button (not mode switch); recognizable icon + label |
| **Plan** | `<button onClick={onCreateSticky}>📝 Sticky Note</button>`. |

#### Unit C-A-3: `Toolbar` — "Rectangle" button

| Field | Value |
|-------|-------|
| **Input** | Click |
| **Output** | Calls `onCreateRectangle()` — creates one rectangle at viewport center |
| **Invariant** | Same as C-A-2 but for rectangles |
| **Constraints** | Same as C-A-2 |
| **Plan** | `<button onClick={onCreateRectangle}>▭ Rectangle</button>`. |

#### Unit C-A-4: `Toolbar` — "Delete" keyboard handler

| Field | Value |
|-------|-------|
| **Input** | Delete/Backspace keypress (board-level) |
| **Output** | If `selectedId` exists AND interaction state is NOT `'editing'` → calls `onDeleteSelected(selectedId)`; otherwise → no-op |
| **Invariant** | Delete only acts when an object is selected AND user is not in text edit mode. Does nothing when nothing is selected. Does nothing when user is editing text (keyboard events are scoped to text editor via `stopPropagation`). Pressing Delete with no selection produces no error, no visible effect. |
| **Constraints** | Story 4.3 — no-op when nothing selected; safe default; I-2 — keyboard scope |
| **Plan** | `window` `keydown` listener. Guard: `selectedId && mode !== 'editing'`. |

---

### Unit C-B: `src/components/ColorPalette.jsx` — Color change UI

| Field | Value |
|-------|-------|
| **Stories** | C.1a, 2.4, 3.2 |
| **Prerequisites** | Unit 3-A (useSelection), Unit 4-A (useBoardObjects) |
| **Props** | `{ selectedObject, onChangeColor }` |

#### Unit C-B-1: `ColorPalette` — Visibility & positioning

| Field | Value |
|-------|-------|
| **Input** | `selectedObject`, viewport state (`panX`, `panY`, `zoom`) |
| **Output** | Rendered when `selectedObject !== null`; hidden otherwise. Positioned absolutely below the selected object, centered horizontally under it. |
| **Invariant** | Color palette is only visible when an object is selected. Position is computed via `boardToScreen(obj.x, obj.y + obj.height, panX, panY, zoom)` so the palette tracks the object as the user pans/zooms. Palette is rendered outside the board's CSS-transformed container (uses absolute positioning in the root viewport div, not inside the scaled inner div). |
| **Constraints** | Story C.1a — appears when object selected; spatial proximity to target object |
| **Plan** | In `App.jsx`: compute screen position of object's bottom-center via `boardToScreen()`. Render `ColorPalette` in an absolutely-positioned wrapper at that position with `zIndex: 160`. |

#### Unit C-B-2: `ColorPalette` — Color swatches

| Field | Value |
|-------|-------|
| **Input** | `OBJECT_COLORS` array |
| **Output** | Colored circle/square buttons, one per color, each with `cursor: pointer` and hover pre-highlight |
| **Invariant** | Shows actual color swatches (not text names). Same palette for both sticky notes and rectangles. Includes at least 6 distinct colors. Swatches have `cursor: pointer`. Swatches scale up (1.25×) on hover with a smooth transition (`transform: scale(1.25)`, `transition: transform 0.1s ease`) to satisfy the pre-highlight-on-hover UX standard. Hover state tracked via `onMouseEnter`/`onMouseLeave` with React `useState`. |
| **Constraints** | Story C.1a — swatches not names; same for both types; recognition over recall. UX standard: all clickable entities must pre-highlight on hover. |
| **Plan** | Map `OBJECT_COLORS` to colored `<button>` elements. Track `hoveredColor` state; apply `transform: scale(1.25)` on hover. |

#### Unit C-B-3: `ColorPalette` — Current color indicator

| Field | Value |
|-------|-------|
| **Input** | `selectedObject.color` |
| **Output** | Currently applied color swatch has a visual indicator (border, checkmark, ring) |
| **Invariant** | The swatch matching the selected object's current color is visually distinguished from other swatches |
| **Constraints** | Story C.1a — current color is visually indicated |
| **Plan** | Compare each swatch color to `selectedObject.color`. If match, add dark border or checkmark overlay. |

#### Unit C-B-4: `ColorPalette` — Color change action

| Field | Value |
|-------|-------|
| **Input** | Click on a color swatch |
| **Output** | `onChangeColor(selectedObject.id, { color: newColor })` called |
| **Invariant** | Clicking a swatch immediately changes the object's color (optimistic update). Syncs to Firebase. Other users see the change. The second argument is a partial updates object `{ color }`, matching the `handleUpdateObject(id, updates)` signature used throughout the app. |
| **Constraints** | Story 2.4 — syncs within 100ms |
| **Plan** | `onClick` → `onChangeColor(id, { color })` → `updateObject(id, { color })`. |

---

### Unit C-C: `src/utils/colors.js` — Color palette constants

| Field | Value |
|-------|-------|
| **Stories** | C.1a, 2.4, 3.2, 4.4 |
| **Prerequisites** | None |
| **Exports** | `OBJECT_COLORS`, `SELECTION_COLOR`, `DEFAULT_STICKY_COLOR`, `DEFAULT_RECTANGLE_COLOR`, `cursorColorFromUid` |

#### Unit C-C-1: `OBJECT_COLORS` — Predefined palette

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | Array of 6+ hex color strings |
| **Invariant** | Palette contains at least 6 visually distinct colors. Palette does NOT include `SELECTION_COLOR` (`#2196F3`). Palette does NOT include pure red (`#FF0000`) or warning amber (`#F59E0B`) — these are reserved for error/warning states. Colors are visible on `#f0f0f0` background. |
| **Constraints** | Story 4.4 — selection color reserved; Story C.5 — error colors sacred |
| **Testing** | **PBT**: `∀ color ∈ OBJECT_COLORS: color !== SELECTION_COLOR`. `∀ color ∈ OBJECT_COLORS: color !== '#FF0000' ∧ color !== '#F59E0B'`. `OBJECT_COLORS.length ≥ 6`. (Set-membership properties — technically exhaustive, but PBT-style assertion ensures any future palette edits are caught.) |
| **Plan** | `['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#DDA0DD', '#98D8C8', '#F7DC6F']`. |

#### Unit C-C-2: `SELECTION_COLOR`

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `'#2196F3'` (blue) |
| **Invariant** | Used only for selection indicators — never for object fills. Verified by absence from `OBJECT_COLORS`. |
| **Constraints** | Story 4.4 — distinct selection color not used for fills |
| **Plan** | Constant. |

#### Unit C-C-3: `DEFAULT_STICKY_COLOR`

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | `'#FFD700'` (yellow) |
| **Invariant** | Default color for newly created sticky notes |
| **Constraints** | Story 2.1 — default yellow |
| **Plan** | Constant. |

#### Unit C-C-4: `DEFAULT_RECTANGLE_COLOR`

| Field | Value |
|-------|-------|
| **Input** | None |
| **Output** | A color from `OBJECT_COLORS` that is not yellow (e.g., `'#4ECDC4'`) |
| **Invariant** | Default color for newly created rectangles. Distinct from `DEFAULT_STICKY_COLOR`. |
| **Constraints** | Rectangles visually distinct from stickies at creation |
| **Plan** | Constant. |

---

## §9. Deploy — `firebase.json`, build config

### User Stories
- 9.1: Reviewer accesses app via public HTTPS URL without local setup.
- 9.2: Single hardcoded board ID. All users on same URL share same board.
- 9.3: No crashes under normal use (5 users, 100 objects). No permission-denied errors.
- 9.4: API keys (Anthropic) not in client code. Firebase config (public) is fine.

---

### Unit 9-A: Build + hosting configuration

| Field | Value |
|-------|-------|
| **Stories** | 9.1, 9.2, 9.3, 9.4 |
| **Prerequisites** | All features implemented |

#### Unit 9-A-1: `vite.config.js` — Build configuration

| Field | Value |
|-------|-------|
| **Input** | `npm run build` |
| **Output** | Production bundle in `dist/` |
| **Invariant** | Build succeeds without errors. Output is in `dist/` directory matching `firebase.json` hosting public path. |
| **Plan** | Already configured. |

#### Unit 9-A-2: `firebase.json` — Hosting config

| Field | Value |
|-------|-------|
| **Input** | Hosting configuration |
| **Output** | SPA rewrite rules, public directory set to `dist` |
| **Invariant** | All routes rewrite to `index.html` (SPA mode). Public directory is `dist`. Firebase deploy serves the built app. |
| **Plan** | Already configured. |

#### Unit 9-A-3: Deploy smoke test

| Field | Value |
|-------|-------|
| **Input** | `firebase deploy` |
| **Output** | Public HTTPS URL (e.g., `https://collabboard-g4-sjc.web.app`) |
| **Invariant** | Deployed URL returns HTTP 200 and renders the sign-in screen. After sign-in, board is functional. No console errors under normal use. Firebase security rules allow authenticated reads/writes. |
| **Plan** | `npm run build && firebase deploy`. Manual verification of deployed URL. |

---

## Integration Invariants (Cross-Unit)

These invariants span multiple units and cannot be attributed to a single unit. Tested at integration level.

### I-1: End-to-end object lifecycle

| Field | Value |
|-------|-------|
| **Stories** | 2.1, 3.1, 4.1, 4.2, 4.3, 5.1 |
| **Invariant** | Create object → object appears in Firebase and in all clients' `objects` map → move object → position updates in Firebase and all clients → edit text/color → updates in Firebase and all clients → delete object → removed from Firebase and all clients' maps. Each step: optimistic local update + Firebase write + remote notification. |
| **Constraints** | Each step completes within 100ms for remote users |

### I-2: Selection ↔ Keyboard scope

| Field | Value |
|-------|-------|
| **Stories** | 2.2, 4.3 |
| **Invariant** | When interaction state is `'editing'`, board-level keyboard handlers (Delete → delete object) are suppressed via `stopPropagation` from the text editor. When state is NOT `'editing'`, board-level handlers are active. |

### I-3: Coordinate system consistency

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 1.2, 6.2 |
| **Invariant** | The coordinate transform in `coordinates.js`, the CSS transform in `Board.jsx`, the pan delta computation in `useViewport`, the zoom-center computation in `useViewport`, and cursor position in `useCursors` all use the same transform model: `screen = (board + pan) * zoom`. Any inconsistency produces visual drift. Verified by golden test vectors at multiple pan/zoom states. |

### I-4: Presence ↔ Auth lifecycle

| Field | Value |
|-------|-------|
| **Stories** | 7.1, 7.4, 8.3, 8.4 |
| **Invariant** | Sign in → presence registered (on `.info/connected`). Sign out → explicit cleanup (cursor + presence removed) THEN `signOut()`. Tab close → `onDisconnect` removes entries + TTL expires within 15s. Refresh → same UID key, re-register overwrites old entry (no ghost duplicate). |

### I-5: Interaction state mutual exclusion

| Field | Value |
|-------|-------|
| **Stories** | 1.1, 4.1 |
| **Invariant** | At any given moment, the board is in exactly one state from the Interaction State Machine. Pointer capture prevents stuck states. Escape from any non-idle state returns to idle. Starting an interaction first exits the current one cleanly. |

### I-6: Zoom ↔ Resize handles size

| Field | Value |
|-------|-------|
| **Stories** | 1.2, 3.3 |
| **Invariant** | Resize handles are at least 8×8px in screen pixels at every zoom level. At zoom=0.1 (board-space size = 80px) and zoom=3.0 (board-space size = 2.67px), measured screen size ≈ 8px. |

### I-7: Remote text overwrite during edit

| Field | Value |
|-------|-------|
| **Stories** | 5.2 |
| **Invariant** | If User A is editing a sticky note's text and User B saves a text change to the same note, User A's textarea content updates to show User B's text. User A remains in edit mode. |

### I-8: Offline resilience

| Field | Value |
|-------|-------|
| **Stories** | 5.3 |
| **Invariant** | Local edits made while offline (Firebase RTDB queues them) are synced when connectivity returns. Connectivity banner appears within 3 seconds of disconnect. Pending objects/changes are not lost. On reconnect, banner disappears and presence re-registers. |

### I-9: Click threshold ↔ Selection vs. Drag

| Field | Value |
|-------|-------|
| **Stories** | 4.1 |
| **Invariant** | A click-and-release with < 5px mouse movement registers as a selection click, not a drag. ≥ 5px initiates drag. Distance measured in screen pixels. |

### I-10: Object creation at viewport center

| Field | Value |
|-------|-------|
| **Stories** | 2.1, 3.1 |
| **Invariant** | An object created via toolbar, at any pan/zoom state, renders at the visual center of the screen. `viewportCenter(panX, panY, zoom, w, h)` → `createObject(x, y)` → object renders at `boardToScreen(x, y)` → screen center ± 1px. |

### I-11: Firebase write metadata

| Field | Value |
|-------|-------|
| **Stories** | 5.2 |
| **Invariant** | Every Firebase write to any object path (`set`, `update`) includes `updatedAt: Date.now()` and `updatedBy: user.uid`. No exceptions. All callers of `createObject` and `updateObject` go through the single functions in `useBoardObjects` which enforce this. |

### I-12: Board tab switching reconciliation

| Field | Value |
|-------|-------|
| **Stories** | C.3 |
| **Invariant** | When user switches back to the CollabBoard tab after it was in background, Firebase RTDB WebSocket reconnects and state reconciles within 1 second without visual glitches. Presence re-registers. Cursor broadcast resumes. |

---

## §4f. Frame Containment & Color — `src/components/Frame.jsx`, `src/App.jsx`, `src/utils/coordinates.js`

### User Stories
- F.1: When I move an object completely inside a Frame, then drag the Frame, all contained objects should move with it.
- F.2: I should be able to set a Frame's color using the color swatches; the border, background tint, and title bar update to reflect the chosen color.

---

### Unit 4f-A: `src/utils/coordinates.js` — Containment helpers

| Field | Value |
|-------|-------|
| **Stories** | F.1 |
| **Prerequisites** | None |
| **Exports** | `containsRect(outer, inner)`, `getObjectBounds(obj)` |

#### Unit 4f-A-1: `containsRect(outer, inner)` — Full containment check

| Field | Value |
|-------|-------|
| **Input** | Two rect objects `{ x, y, width, height }` |
| **Output** | `true` if `inner` is fully inside `outer` (inclusive edges) |
| **Invariant** | `containsRect(r, r) === true` (self-containment). Returns false if inner extends beyond outer on any edge. |
| **Testing** | Example-based edge cases + PBT: `∀ rect: containsRect(rect, rect) === true`; `∀ (outer, inner) constructed inside: containsRect(outer, inner) === true`. |
| **Plan** | Compare all four edges: `outer.x ≤ inner.x`, `outer.y ≤ inner.y`, `outer.x+w ≥ inner.x+w`, `outer.y+h ≥ inner.y+h`. |

#### Unit 4f-A-2: `getObjectBounds(obj)` — Normalize object to bounding rect

| Field | Value |
|-------|-------|
| **Input** | Board object (rect-like with `x, y, width, height` or line-like with `x1, y1, x2, y2`) |
| **Output** | `{ x, y, width, height }` bounding rect |
| **Invariant** | Line-like objects produce a rect from `min(x1,x2)..max(x1,x2)` × `min(y1,y2)..max(y1,y2)`. Rect-like objects pass through. Missing `width`/`height` default to 0. |
| **Testing** | Example-based: rect-like, line-like (reversed coords), missing dimensions. |
| **Plan** | Check for `x1`/`y1` presence to detect line-like objects. |

---

### Unit 4f-B: `src/App.jsx` — Frame drag includes contained children

| Field | Value |
|-------|-------|
| **Stories** | F.1 |
| **Prerequisites** | Units 4f-A (containment helpers), 2-B (useDrag), 3-A (useSelection) |

#### Unit 4f-B-1: `handleDragStart` — Collect frame children on drag

| Field | Value |
|-------|-------|
| **Input** | Frame object being dragged, all board objects |
| **Output** | `selectedObjects` array containing the frame + all objects whose bounds are fully inside the frame |
| **Invariant** | Only objects with `containsRect(frameBounds, objBounds) === true` are included. The frame itself is always in the array. Selection state is updated via `setSelection()` to include all children. Per-item throttles are created so all objects move in sync. |
| **Constraints** | Does not apply when the user already has a multi-selection (existing multi-drag takes priority). |
| **Plan** | In `handleDragStart`, when `object.type === 'frame'` and no existing multi-selection, compute frame bounds, filter all objects by `containsRect`, build `selectedObjects`, call `selection.setSelection()`. |

---

### Unit 4f-C: `src/hooks/useDrag.js` — Per-item throttles for multi-drag

| Field | Value |
|-------|-------|
| **Stories** | F.1 |
| **Prerequisites** | Unit 4-C (throttle) |

#### Unit 4f-C-1: `useDrag` — Per-item throttle allocation

| Field | Value |
|-------|-------|
| **Input** | `selectedObjects` array passed to `handleDragStart` |
| **Output** | One independent `throttle()` instance per item stored in `multiUpdateRef.current.throttles` |
| **Invariant** | Each item's position updates go through its own throttle, preventing the shared throttle's single `pendingArgs` slot from dropping updates. All throttles are flushed on `handleDragEnd`. |
| **Plan** | Create `throttles = {}` map in `handleDragStart`. In `handleDragMove`, use `throttles[item.id]` instead of shared `throttledUpdate`. In `handleDragEnd`, flush all per-item throttles. |

---

### Unit 4f-D: `src/components/Frame.jsx` — Color support

| Field | Value |
|-------|-------|
| **Stories** | F.2 |
| **Prerequisites** | Unit C-C (ColorPalette) |

#### Unit 4f-D-1: `Frame` — Apply `object.color` to visuals

| Field | Value |
|-------|-------|
| **Input** | `object.color` (hex string or undefined) |
| **Output** | Border uses `object.color`; background uses `${color}22` (≈13% opacity); title bar uses `${color}33` (≈20% opacity) |
| **Invariant** | When `object.color` is unset, defaults to original dashed grey border and translucent slate fill. When set, all three regions (border, body, title bar) reflect the chosen color with appropriate opacity. Color changes sync via the existing `onUpdate` → Firebase path. |
| **Testing** | Example-based: default colors when no color set; custom color applied to border, background, and title bar. |
| **Plan** | Ternary on `object.color` for `border`, `background`, and title bar `background`/`borderBottom` CSS properties. |

---

## Appendix: Firebase Path Reference

| Path | Unit | Purpose |
|------|------|---------|
| `boards/{BOARD_ID}/objects/{objectId}` | 4-A | Object state (id, type, x, y, width, height, text, color, updatedAt, updatedBy, zIndex) |
| `boards/{BOARD_ID}/cursors/{uid}` | 6-A | Cursor position (x, y, name, lastActiveAt) |
| `boards/{BOARD_ID}/presence/{uid}` | 7-A | Presence entry (uid, name, photoURL, lastActiveAt) |
| `.info/connected` | 5-A, 6-A, 7-A | Firebase connectivity state (boolean) |

## Appendix: State Interaction Matrix

Shows which interaction states block/modify which other states.

| Active State | Blocks | Modifies | On External Kill (blur/pointercancel) |
|-------------|--------|----------|--------------------------------------|
| **Panning** | Object drag, resize, text edit | `panX`, `panY` | Stops at last position; releases pointer capture |
| **Dragging object** | Pan, text edit for that object | Object `x`, `y`, `zIndex` | Drops at last position; flushes throttle; releases pointer capture |
| **Resizing** | Pan, drag, text edit | Object `width`, `height`, possibly `x`, `y` | Stops at last dimensions; flushes throttle; releases pointer capture |
| **Editing text** | Board keyboard handlers (Delete), Ctrl+wheel zoom | Object `text` | Saves current text; exits edit mode |
| **Zooming** | Nothing (instant) | `zoom`, `panX`, `panY` | N/A (instant, no persistent state) |

## Appendix: Data Model (Firebase Object Schema)

```javascript
{
  id: 'obj-xxx',           // string, unique, Firebase-key-safe
  type: 'sticky',          // 'sticky' | 'rectangle'
  x: 100,                  // number, board-space
  y: 200,                  // number, board-space
  width: 200,              // number, board-space (fixed 200 for sticky)
  height: 150,             // number, board-space (min 150 for sticky, min 20 for rect)
  text: 'Hello',           // string, sticky only (empty string allowed)
  color: '#FFD700',        // hex color string from OBJECT_COLORS
  zIndex: 1,               // integer, higher = on top
  updatedAt: 1676543210,   // Date.now() client timestamp
  updatedBy: 'user-xyz'    // user UID
}
```
