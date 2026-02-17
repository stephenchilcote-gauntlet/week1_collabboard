# DAG.md — Implementation DAG for CollabBoard MVP

References units from UNITS.md by ID. **[PBT]** = property-based tests required.

---

## Phase 0 — DONE (baseline)

- `0-A`, `8-A-1..4`, `8-B-1..5`

---

## Phase 1 — Pure constants + pure utilities (zero React/Firebase)

All lanes are mutually parallel.

### Lane 1: Firebase config constant
1. `8-A-5` (done)

### Lane 2: `src/utils/coordinates.js`
1. `1-B-1` **[PBT]** (done)
2. `1-B-2` **[PBT]** (done)
3. `1-B-3` **[PBT]** (done)

### Lane 3: `src/utils/ids.js`
1. `4-B-1` **[PBT]** (done)

### Lane 4: `src/utils/throttle.js`
1. `4-C-1` **[PBT]** (done)
2. `4-C-2` **[PBT]** → depends on `4-C-1` (done)

### Lane 5: `src/utils/colors.js`
1. `C-C-2` **[PBT]** (done)
2. `C-C-1` **[PBT]** → depends on `C-C-2` (done)
3. `C-C-3` (done)
4. `C-C-4` (done)
5. `6-C-1` **[PBT]** → after constants (done)

---

## Phase 2 — Local-only state hooks (no Firebase)

All lanes are mutually parallel.

### Lane 1: `src/hooks/useInteractionState.js`
1. `2-A-1` (done)

### Lane 2: `src/hooks/useSelection.js`
1. `3-A-1` (done)
2. `3-A-2` (done)
3. `3-A-3` (done)
4. `3-A-4` (done)
> `3-A-5` deferred to Phase 5 (needs live objects map)

### Lane 3: `src/hooks/useViewport.js`
1. `1-A-1` (done)
2. `1-A-2` (done)
3. `1-A-3` **[PBT]** (done)
4. `1-A-4` (done)
5. `1-A-5` **[PBT]** (done)
6. `1-A-6` (done)
7. `1-A-7` (done)
8. `1-A-8` (done)

---

## Phase 3 — Board surface component (pan/zoom + event routing)

### Lane 1: `src/components/Board.jsx`
1. `1-C-1` → depends on `1-A-*` (done)
2. `1-C-2` → depends on `1-C-1` (done)
3. `1-C-4` → depends on `1-A-5`, `1-A-6` (done)
4. `1-C-3` → routing skeleton (dummy `data-object-id` for testing) (done)
5. `1-C-5` (done)
> `1-C-6` deferred to Phase 7 (needs `4-A-1`)

---

## Phase 4 — Firebase hooks + connectivity

All lanes are mutually parallel.

### Lane 1: `src/hooks/useBoardObjects.js` — core CRUD
1. `4-A-1` → depends on `8-A-5` (done)
2. `4-A-2` → depends on `4-A-1`, `4-B-1`, `C-C-3`, `C-C-4` (done)
3. `4-A-3` → depends on `4-A-1` (done)
4. `4-A-4` → depends on `4-A-1` (done)
> `4-A-5`, `4-A-6` deferred to Phase 5 (need drag/edit states)

### Lane 2: `src/components/ConnectionStatus.jsx`
1. `5-A-1` → depends on `8-A-5` (done)
2. `5-A-2` → depends on `5-A-1` (done)
3. `5-A-3` → depends on `5-A-2` (done)

### Lane 3: `src/hooks/useCursors.js`
1. `6-A-1` → depends on `8-A-5`, `1-B-*`, `4-C-*` (done)
2. `6-A-2` → depends on `6-A-1` (done)
3. `6-A-3` → depends on `6-A-2` (done)

### Lane 4: `src/hooks/usePresence.js`
1. `7-A-1` → depends on `8-A-5` (done)
2. `7-A-2` → depends on `7-A-1` (done)
3. `7-A-3` → depends on `7-A-1`, `7-A-2` (done)

**Integration invariants now feasible:** `I-11`, `I-4`

---

## Phase 5 — Drag + resize hooks + sync edge behaviors

### Lane 1: `src/hooks/useDrag.js`
1. `2-B-1` → depends on `1-B-*`, `4-A-3`, `3-A-*` (done)
2. `2-B-2` → depends on `2-B-1`, `4-C-*` (done)
3. `2-B-4` **[PBT]** → can be implemented/tested standalone (done)
4. `2-B-3` → depends on `2-B-2`, `4-C-2`, `2-B-4` (done)

### Lane 2: `src/hooks/useResize.js`
1. `2-C-1` → depends on `1-B-*`, `4-A-3` (done)
2. `2-C-2` **[PBT]** → depends on `2-C-1`, `4-C-*` (done)
3. `2-C-3` → depends on `2-C-2`, `4-C-2` (done)

### Lane 3: `src/hooks/useBoardObjects.js` — sync edge cases
1. `4-A-5` → depends on `2-B-*` (done)
2. `4-A-6` → depends on edit/drag states (done)

### Lane 4: `src/hooks/useSelection.js` — deletion reconciliation
1. `3-A-5` → depends on `4-A-1` (done)

**Integration invariants validated:** `I-9`, `I-5` (partial)

---

## Phase 6 — Core UI components

All lanes are mutually parallel.

### Lane 1: `src/components/SelectionOverlay.jsx`
1. `3-B-1` → depends on `C-C-2` (done)
2. `3-B-2` **[PBT]** → depends on `3-B-1` (done)

### Lane 2: `src/components/StickyNote.jsx`
1. `4a-A-1` (done)
2. `4a-A-2` (done)
3. `4a-A-9` (done)
4. `4a-A-3` (done)
5. `4a-A-4` (done)
6. `4a-A-5` (done)
7. `4a-A-6` (done)
8. `4a-A-7` (done)
9. `4a-A-8` (done)

### Lane 3: `src/components/Rectangle.jsx`
1. `4b-A-1` (done)
2. `4b-A-2` (done)

### Lane 4: `src/components/CursorOverlay.jsx`
1. `6-B-1` → depends on `1-B-2`, viewport (done)
2. `6-B-2` → depends on `6-C-1` (done)
3. `6-B-3` → depends on `1-A-8` (done)

### Lane 5: `src/components/PresenceBar.jsx`
1. `7-B-1` (done)
2. `7-B-2` (done)
3. `7-B-3` (done)
4. `7-B-4` (done)

**Integration invariants validated:** `I-6`, `I-7`

---

## Phase 7 — Toolbar + color UI + loading/error + remote perception

### Lane 1: `src/components/Toolbar.jsx`
1. `C-A-1` (done)
2. `C-A-2` (done)
3. `C-A-3` (done)
4. `C-A-4` → depends on `2-A-1`, `3-A-*` (done)

### Lane 2: `src/components/ColorPalette.jsx`
1. `C-B-1` (done)
2. `C-B-2` → depends on `C-C-1` (done)
3. `C-B-3` (done)
4. `C-B-4` → depends on `4-A-3` (done)

### Lane 3: `src/components/Board.jsx` — loading gate
1. `1-C-6` → depends on `4-A-1` (done)

### Lane 4: `src/components/ErrorBanner.jsx`
1. `5-C-1` (done)

### Lane 5: Remote change perception
1. `5-B-1` → depends on `4-A-1` (done)
2. `5-B-2` → depends on `4-A-1` (done)
3. `5-B-3` → depends on `1-B-2`, `1-A-8` (done)

**Integration invariants validated:** `I-1`, `I-2`, `I-3`, `I-8`, `I-10`

---

## Phase 8 — Deploy

1. `9-A-1`
2. `9-A-2`
3. `9-A-3`

**Integration invariants validated:** `I-12`

---

## Cross-Phase Dependency Edges

```
8-A-5 → 4-A-1..6, 6-A-1..3, 7-A-1..3, 5-A-1..3
1-B-1..3 → 6-A-1, 6-B-1, 2-B-1..4, 2-C-1..3, 5-B-3
4-B-1 → 4-A-2
4-C-1..2 → 2-B-2..3, 2-C-2..3, 6-A-1
C-C-1..4 → C-B-2..4, 4-A-2 (defaults), 3-B-1 (visual constraints)
6-C-1 → 6-B-2
1-A-1..8 → 1-C-1..5, 6-B-3, 5-B-3
4-A-1..4 → 2-B-*, 2-C-*, C-A-*, C-B-*, 1-C-6
2-B-* → 4-A-5
4-A-1 → 3-A-5
3-A-* → 3-B-*, C-A-4, C-B-*
```

---

## PBT Checklist

| Phase | Units |
|-------|-------|
| 1 | `1-B-1`, `1-B-2`, `1-B-3`, `4-B-1`, `4-C-1`, `4-C-2`, `C-C-1`, `C-C-2`, `6-C-1` |
| 2 | `1-A-3`, `1-A-5` |
| 5 | `2-B-4`, `2-C-2` |
| 6 | `3-B-2` |
