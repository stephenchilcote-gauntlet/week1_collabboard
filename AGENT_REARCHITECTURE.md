# useAiAgent Refactor: Single Source of Truth

## Problem

`useAiAgent` maintains two parallel representations of conversation state:
1. `historyRef` — API-format messages sent to Claude (includes `tool_use`/`tool_result` content blocks)
2. `displayMessages` — simplified UI messages (`{ role, text, ok?, pending? }`)

These are updated independently by 6+ different `setDisplayMessages` call sites (`handleToolCall`, `handleStream` toolStart, optimistic user message, final post-runAgent assembly, error handler, `loadConversation`). Any new feature or bug fix must update both in sync. This is the root cause of recurring display bugs.

## Goal

Make `displayMessages` a **derived view** of one canonical history array. No independent `setDisplayMessages` calls except for transient streaming state (pending tool labels).

## Architecture

### Single canonical state: `displayHistoryRef`

Replace the current `displayMessages` state + `historyRef` with:

1. **`historyRef`** (ref, not state) — the API-format messages array. Passed directly to `runAgent`. No changes to its current role.
2. **`displayHistoryRef`** (ref) — array of `{ role, text, ok? }` display entries. This is the **source of truth** for what the UI shows.
3. **`displayMessages`** (state) — still exists, but is ONLY set by reading from `displayHistoryRef.current`. Never constructed ad-hoc.

### Pure derivation function: `apiHistoryToDisplay`

Create an exported pure function (no hooks, no side effects):

```
apiHistoryToDisplay(apiMessages) → DisplayMessage[]
```

**Input**: the API-format messages array from `runAgent` (same shape as `result.messages`).

**Output**: array of `{ role: 'user' | 'assistant' | 'tool', text: string, ok?: boolean }`.

**Rules** (process each message in order):
- `{ role: 'user', content: string }` → emit `{ role: 'user', text: content }`
- `{ role: 'user', content: Array }` → skip (these are `tool_result` blocks, already represented by tool entries)
- `{ role: 'assistant', content: string }` → emit `{ role: 'assistant', text: content }`
- `{ role: 'assistant', content: Array }` → for each block in the array:
  - `block.type === 'text'` and `block.text` is non-empty → emit `{ role: 'assistant', text: block.text }`
  - `block.type === 'tool_use'` → emit `{ role: 'tool', text: summarizeToolCall(block.name, block.input), ok: true }`. Look up the corresponding `tool_result` in the **next** message (which will be `{ role: 'user', content: [...tool_result blocks] }`). Find the `tool_result` where `tool_use_id === block.id`. Parse its `content` as JSON. If the parsed object has `ok === false`, set `ok: false` on the emitted display entry.
  - All other block types (e.g. `thinking`) → skip

### Transient streaming state

During an active `runAgent` call, the UI needs to show:
- Pending tool labels (`"Creating…"`) before tool execution completes
- Optimistic user message before `runAgent` returns

Handle this with a separate `pendingDisplayRef` (ref) that holds an array of transient entries appended during streaming. The final `displayMessages` state is computed as:

```
displayMessages = [...apiHistoryToDisplay(historyRef.current), ...pendingDisplayRef.current]
```

Call `setDisplayMessages(...)` with this formula at each point where either ref changes.

When `runAgent` completes, clear `pendingDisplayRef.current` and recompute from the final `historyRef.current`.

### Changes to `submit`

1. Before calling `runAgent`: set `pendingDisplayRef.current = [{ role: 'user', text: message }]` and flush to state.
2. `handleStream` `toolStart` event: append `{ role: 'tool', text: TOOL_PENDING_LABELS[name], pending: true }` to `pendingDisplayRef.current` and flush.
3. `handleToolCall`: replace the last `pending: true` entry in `pendingDisplayRef.current` with `{ role: 'tool', text: summarizeToolCall(name, input), ok }` and flush.
4. `handleStream` `text` event: if `pendingDisplayRef` has no assistant text entry yet, append `{ role: 'assistant', text: streamingTextRef.current }` to pending, otherwise update it in place. (Or: continue using `streamingText` state as-is for the streaming text bubble — it's already separate from `displayMessages`.)
5. After `runAgent` returns: set `historyRef.current = result.messages`, clear `pendingDisplayRef.current = []`, compute `displayMessages` from `apiHistoryToDisplay(historyRef.current)`, flush to state.
6. On error: append `{ role: 'assistant', text: 'Error: ...' }` to the current display (it won't be in API history, which is fine — errors aren't sent to Claude).

### Changes to `loadConversation`

1. Read `conv.messages` from Firebase into `historyRef.current`.
2. Compute `setDisplayMessages(apiHistoryToDisplay(historyRef.current))`.
3. Remove all `conv.displayMessages` / `buildDisplayMessages` legacy code paths.

### Changes to Firebase persistence

Stop persisting `displayMessages` separately. Only persist `messages` (the API-format history). Display is always re-derived on load via `apiHistoryToDisplay`.

Remove the `displayMessages` field from `updateConversation` calls. The `displayForPersist` variable and all code building it should be deleted.

### Changes to conversation list preview

The conversation list listener (line 70-93) currently reads `conv.messages` looking for `{ role: 'user', content: string }` to build previews. This still works because API-format user messages have `content` as a string.

### What to delete

- `buildDisplayMessages` function (lines 19-25)
- `displayForPersist` variable and its construction
- `displayMessages` field in `updateConversation` calls
- The `conv.displayMessages` fallback in `loadConversation`
- All 6 ad-hoc `setDisplayMessages` call sites inside `submit` (replaced by the pending ref + flush pattern)
- `TOOL_PENDING_LABELS` is still needed (for streaming pending state)
- `summarizeToolCall` is still needed (used by `apiHistoryToDisplay`)

## Files to modify

- `src/hooks/useAiAgent.js` — all changes above
- `src/hooks/useAiAgent.test.js` — update tests. Key assertions:
  - `apiHistoryToDisplay` is a pure function: test it directly with various API message shapes
  - `submit` with no tools: display shows `[user, assistant]`
  - `submit` with tools: display shows `[user, tool(s), assistant]` with correct summaries and ok flags
  - `submit` with failed tool: tool entry has `ok: false`
  - Multi-turn: display accumulates correctly across two submits
  - `loadConversation`: display is derived from API history
  - `startNewConversation`: display clears
  - Error during submit: error message appears in display
  - User message is never lost (the stale-closure bug that motivated this refactor)

## Do NOT change

- `src/ai/agent.js` — `runAgent` signature and return value are unchanged
- `src/ai/executor.js` — unchanged
- `src/ai/tools.js` — unchanged
- The `streamingText` / `thinkingText` / `isThinking` state — these are ephemeral streaming UI state, not conversation history. Leave them as-is.
- The hook's return signature — `displayMessages` shape `{ role, text, ok? }` is consumed by `AiChat.jsx`. Do not change the shape.
