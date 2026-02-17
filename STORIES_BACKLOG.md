# STORIES_BACKLOG.md — Post-MVP User Stories

Stories use "I should…" / "When I…" format. "I" = the end user unless stated otherwise.

---

## Board Features (Codex-ready)

These stories are self-contained and can be implemented independently. Each follows the existing patterns in the codebase: factory function in `useBoardObjects.js`, component in `src/components/`, toolbar button in `Toolbar.jsx`, rendering branch in `Board.jsx`, and keyboard shortcut.

**Testing rule:** Every story below MUST have corresponding tests. Use Vitest + `@testing-library/react` + `vi.fn()` mocks, matching the conventions in existing `*.test.jsx` files. Firebase is mocked globally via `src/test/setup.js`. Each new component gets a co-located `ComponentName.test.jsx`. Each new hook gets a co-located `useHookName.test.js`. Toolbar additions should be tested in `Toolbar.test.jsx`.

### Circle Shape
- When I click the "Circle" toolbar button (or press C), a circle should appear at the center of my viewport.
- I should be able to drag a circle to reposition it.
- I should be able to resize a circle via handles (resize should maintain aspect ratio).
- I should be able to change a circle's color via the color palette.
- The circle should render as a `border-radius: 50%` div, following the same pattern as `Rectangle.jsx`.
- Circles should sync in real-time — when one user creates or moves a circle, all users see it.

**Tests (`Circle.test.jsx`):**
- Renders with `data-object-id`, correct color, and `border-radius: 50%`.
- `pointerDown` calls `onSelect` and `onDragStart`.
- `lockedByOther` blocks pointer events, shows reduced opacity and `not-allowed` cursor.
- Toolbar: "Circle" button click fires `onCreateCircle`. `C` key fires `onCreateCircle`. Shortcut disabled during `interactionMode === 'editing'`.

### Line Shape
- When I click the "Line" toolbar button (or press L), a line should appear at the center of my viewport.
- A line has two endpoints (`x1, y1, x2, y2`) and renders as an SVG `<line>` or a rotated thin div.
- I should be able to drag a line to reposition it (moves both endpoints).
- I should be able to drag individual endpoints to reshape the line.
- I should be able to change a line's color via the color palette.
- Lines should have a configurable stroke width (default 2px).
- Lines should sync in real-time.

**Tests (`Line.test.jsx`):**
- Renders with `data-object-id` and correct stroke color.
- `pointerDown` on the line body calls `onSelect` and `onDragStart`.
- Dragging an endpoint calls `onUpdate` with new endpoint coordinates.
- `lockedByOther` blocks pointer events.
- Toolbar: "Line" button click fires `onCreateLine`. `L` key fires `onCreateLine`.

### Connectors / Arrows
- When I click the "Connector" toolbar button (or press K), I should enter connector-creation mode.
- In connector mode, clicking a first object highlights it as the source; clicking a second object creates a connector between them.
- A connector stores `fromId` and `toId` and draws a line between the center points of those objects.
- When I move either connected object, the connector line should update its endpoints automatically.
- I should be able to toggle an arrowhead on either end of a connector.
- When a connected object is deleted, the connector should also be deleted.
- Connectors should sync in real-time.

**Tests (`Connector.test.jsx`):**
- Renders a line/SVG between the center points of two given objects.
- Updates endpoint positions when source/target object positions change (re-render with new props).
- Renders an arrowhead when `style === 'arrow'`.
- Calls `onSelect` on `pointerDown`.
- Toolbar: `K` key enters connector-creation mode. Clicking two objects in sequence fires `onCreateConnector(fromId, toId)`.

### Standalone Text Elements
- When I click the "Text" toolbar button (or press T), a text element should appear at the center of my viewport.
- A text element renders as an editable text block with no background/border (transparent container).
- I should be able to double-click to edit the text inline (same pattern as StickyNote editing).
- I should be able to drag a text element to reposition it.
- I should be able to resize a text element's bounding box.
- Text elements should have a configurable font size (default 16px).
- Text should sync in real-time.

**Tests (`TextElement.test.jsx`):**
- Renders with `data-object-id`, transparent background, and correct text content.
- Double-click enables inline editing (contentEditable or textarea appears).
- `onBlur` after editing calls `onUpdate` with new text.
- `pointerDown` calls `onSelect` and `onDragStart`.
- `lockedByOther` blocks pointer events.
- Toolbar: "Text" button click fires `onCreateText`. `T` key fires `onCreateText`.

### Frames
- When I click the "Frame" toolbar button (or press F), a frame should appear at the center of my viewport.
- A frame is a large, labeled container (title bar at top, dashed or light border, semi-transparent fill).
- I should be able to edit the frame's title by double-clicking it.
- I should be able to drag a frame to reposition it. When I drag a frame, all objects whose center is inside the frame should move with it.
- I should be able to resize a frame via handles.
- Frames should render behind other objects (lower z-index).
- Frames should sync in real-time.

**Tests (`Frame.test.jsx`):**
- Renders with `data-object-id`, title text, dashed border, and semi-transparent fill.
- Double-click on title enables inline editing; `onBlur` calls `onUpdate` with new title.
- `pointerDown` calls `onSelect` and `onDragStart`.
- Renders with a lower z-index than other object types.
- `lockedByOther` blocks pointer events.
- Toolbar: "Frame" button click fires `onCreateFrame`. `F` key fires `onCreateFrame`.

### Rotation
- When I select an object, I should see a rotation handle above the selection overlay.
- Dragging the rotation handle should rotate the object around its center.
- The rotation angle (in degrees) should be stored on the object as `rotation` and applied via CSS `transform: rotate()`.
- Rotation should work for sticky notes, rectangles, circles, text elements, and frames.
- Rotation should sync in real-time.

**Tests (`useRotation.test.js` + `SelectionOverlay.test.jsx` additions):**
- `useRotation` hook: dragging from 12-o'clock position clockwise produces positive angle; counter-clockwise produces negative angle.
- Rotation angle is clamped/normalized to 0–360.
- `SelectionOverlay` renders a rotation handle when an object is selected.
- Object component applies `transform: rotate(Xdeg)` when `rotation` prop is set.

### Multi-Select
- When I hold Shift and click objects, each clicked object should be added to (or removed from) the selection set.
- When I drag on empty canvas space (not panning), I should see a selection marquee rectangle.
- When I release the marquee, all objects whose bounding boxes intersect the marquee should be selected.
- When multiple objects are selected, the selection overlay should show a combined bounding box.
- When I drag any selected object, all selected objects should move together (maintaining relative positions).
- When I press Delete/Backspace with multiple objects selected, all selected objects should be deleted.

**Tests (`useSelection.test.js` additions + `SelectionMarquee.test.jsx`):**
- Shift+click adds an unselected object to the selection set; shift+click on an already-selected object removes it.
- `selectedIds` is a `Set` containing all selected object IDs.
- Marquee drag on empty space creates a selection rectangle; releasing it selects objects whose bounding boxes intersect.
- **[PBT]** Marquee intersection: given random object positions and a random marquee rect, `getIntersectingIds(objects, marquee)` returns exactly the objects that overlap.
- Dragging one selected object moves all selected objects by the same delta.
- Delete/Backspace with multi-selection calls `onDeleteSelected` for each selected ID.

### Copy / Paste / Duplicate
- When I press Ctrl+C with object(s) selected, those objects should be copied to a clipboard (in-memory, not system clipboard).
- When I press Ctrl+V, copied objects should be pasted at a slight offset from their original position.
- When I press Ctrl+D with object(s) selected, duplicates should appear immediately at a slight offset.
- Pasted/duplicated objects should get new IDs and sync to Firebase as new objects.

**Tests (`useClipboard.test.js`):**
- `copy([obj1, obj2])` stores objects; `paste()` returns clones with new IDs and offset positions.
- Pasted objects have different IDs from originals.
- Paste with empty clipboard returns an empty array.
- Ctrl+C with selection calls `copy`; Ctrl+V calls `paste`; Ctrl+D calls `copy` then `paste` in one step.
- Duplicated objects have positions offset by (+20, +20) from originals.

### Undo / Redo
- When I press Ctrl+Z, the last action (create, move, resize, edit, delete, color change) should be reversed.
- When I press Ctrl+Shift+Z (or Ctrl+Y), the last undone action should be re-applied.
- The undo stack should hold at least 50 actions.
- Undo/redo should only affect my own actions, not other users' actions.
- Undo of a delete should restore the object to its pre-deletion state.

**Tests (`useUndoRedo.test.js`):**
- `push(action)` adds to undo stack; `undo()` reverses last action; `redo()` re-applies it.
- Undo of a create action calls `deleteObject`. Undo of a delete calls `restoreObject` with the saved snapshot.
- Undo of a move/resize/edit/color restores previous values via `updateObject`.
- `redo()` with empty redo stack is a no-op.
- `undo()` with empty undo stack is a no-op.
- Stack overflow: pushing a 51st action evicts the oldest entry.
- A new action after an undo clears the redo stack.
- Ctrl+Z fires `undo()`; Ctrl+Shift+Z and Ctrl+Y fire `redo()`. Shortcuts disabled during `interactionMode === 'editing'`.

---

## AI Board Agent (detailed implementation)

### Cloud Function — `aiCommand`

#### Authentication & Request Validation
- As a Cloud Function, when I receive a request without a valid Firebase ID token in the `Authorization: Bearer <token>` header, I should return 401.
- As a Cloud Function, when I receive a request with a valid token, I should extract `uid` and `displayName` from the decoded token and use them as `updatedBy` / `updatedByName` on all created/modified objects.
- As a Cloud Function, when the request body is missing `boardId` or `message`, I should return 400 with a descriptive error.

**Tests (`functions/index.test.js` — auth & validation):**
- Request with no `Authorization` header → 401 response.
- Request with invalid/expired token → 401 response.
- Request with valid token but missing `boardId` → 400 with error message containing "boardId".
- Request with valid token but missing `message` → 400 with error message containing "message".
- Request with valid token and complete body → does not return 4xx (proceeds to AI call).

#### Anthropic Integration
- As a Cloud Function, I should read `ANTHROPIC_API_KEY` from Firebase Functions config (environment variable, never hardcoded).
- As a Cloud Function, I should call Anthropic's Messages API with tool-use (function calling) enabled.
- The system prompt should instruct the model that it is a whiteboard assistant and should use the provided tools to manipulate the board. It should never respond with raw JSON — only tool calls.
- The model should be `claude-sonnet-4-20250514` (or configurable via env var).
- As a Cloud Function, I should set `max_tokens` to 4096 and `temperature` to 0 for deterministic tool use.

**Tests (`functions/index.test.js` — Anthropic integration, mock the Anthropic SDK):**
- Calls `Anthropic.messages.create` with the correct model, `max_tokens: 4096`, and `temperature: 0`.
- System prompt contains the word "whiteboard" and instructs tool use.
- Passes the user's message as the first user-role message.
- When `ANTHROPIC_API_KEY` env var is missing, returns 500 with a descriptive error.

#### Tool Definitions
- The Cloud Function should define the following tools for the Anthropic API:

  **`createStickyNote`** — parameters: `text` (string), `x` (number), `y` (number), `color` (string, optional, default from `DEFAULT_STICKY_COLOR`).

  **`createShape`** — parameters: `type` (enum: rectangle, circle, line), `x` (number), `y` (number), `width` (number), `height` (number), `color` (string, optional).

  **`createFrame`** — parameters: `title` (string), `x` (number), `y` (number), `width` (number), `height` (number).

  **`createConnector`** — parameters: `fromId` (string), `toId` (string), `style` (enum: line, arrow).

  **`moveObject`** — parameters: `objectId` (string), `x` (number), `y` (number).

  **`resizeObject`** — parameters: `objectId` (string), `width` (number), `height` (number).

  **`updateText`** — parameters: `objectId` (string), `newText` (string).

  **`changeColor`** — parameters: `objectId` (string), `color` (string).

  **`deleteObject`** — parameters: `objectId` (string).

  **`getBoardState`** — no parameters. Returns all objects on the board as a JSON map.

**Tests (`functions/index.test.js` — tool definitions):**
- The tools array passed to Anthropic contains exactly 10 tools: `createStickyNote`, `createShape`, `createFrame`, `createConnector`, `moveObject`, `resizeObject`, `updateText`, `changeColor`, `deleteObject`, `getBoardState`.
- Each tool definition has a `name`, `description`, and `input_schema` with correct property types.
- `createShape` schema `type` parameter has enum `[rectangle, circle, line]`.
- `createConnector` schema `style` parameter has enum `[line, arrow]`.

#### Tool Execution
- When the Anthropic response contains `tool_use` blocks, the Cloud Function should execute each tool call sequentially against Firebase Realtime Database.
- Each created object should follow the same schema as objects created by the client (same fields: `id`, `type`, `x`, `y`, `width`, `height`, `color`, `text`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, `updatedByName`, `zIndex`).
- `getBoardState` should read from `boards/{boardId}/objects` and return the result back to the Anthropic conversation as a tool result, then continue the conversation so the model can make further tool calls based on the board state.
- The Cloud Function should support multi-turn tool use — if Anthropic returns more tool calls after receiving tool results, keep executing until the model returns a final text response (or a max of 10 iterations to prevent runaway loops).

**Tests (`functions/index.test.js` — tool execution, mock Firebase Admin SDK):**
- `createStickyNote` tool call writes a sticky object to `boards/{boardId}/objects/{id}` with all required fields.
- Created object has `createdBy` and `updatedBy` set to the authenticated user's `uid`.
- `moveObject` reads existing object, writes updated `x`, `y`, and `updatedAt`.
- `moveObject` with a nonexistent `objectId` returns a tool result with an error message (does not throw).
- `getBoardState` reads `boards/{boardId}/objects` and returns the snapshot as a tool result, then the conversation continues.
- Multi-turn: when Anthropic responds with `tool_use`, then after tool result responds with another `tool_use`, the function executes both rounds (mock 2 sequential Anthropic responses).
- Runaway protection: after 10 tool-use iterations, the function stops and returns what it has.

#### Response Format
- The Cloud Function should return `{ success: true, message: <model's final text response>, actionsPerformed: [{ tool, params, result }] }` on success.
- On Anthropic API errors, return `{ success: false, error: <error message> }` with status 500.
- On tool execution errors (e.g., objectId not found for moveObject), log the error, return a tool result with an error message to the model so it can recover, and continue the conversation.

**Tests (`functions/index.test.js` — response format):**
- Successful single-tool call returns `{ success: true, message: "...", actionsPerformed: [{ tool: "createStickyNote", params: {...}, result: {...} }] }`.
- Anthropic API error (mocked rejection) returns `{ success: false, error: "..." }` with status 500.
- Tool execution error (e.g., Firebase write fails) does not crash the function — returns error in tool result, continues conversation.

### Chat UI — `src/components/AiChat.jsx`

#### Panel Layout
- I should see a small AI chat toggle button (💬 icon) fixed to the bottom-right of the screen.
- When I click the toggle, a chat panel should slide up/expand (300px wide, max 500px tall).
- The panel should have a message history area (scrollable) and a text input with a send button at the bottom.
- When I click the toggle again (or press Escape), the panel should collapse.
- The toggle button should pre-highlight on hover.

**Tests (`AiChat.test.jsx` — panel layout):**
- Toggle button renders with 💬 icon.
- Clicking toggle shows the chat panel (panel is in the DOM with visible styles).
- Clicking toggle again hides the chat panel.
- Pressing Escape while panel is open hides it.
- Toggle button changes background on `mouseEnter`; reverts on `mouseLeave`.
- Panel contains a text input and a send button.

#### Sending Commands
- When I type a message and press Enter (or click Send), the message should appear in the chat history as a "user" message bubble.
- A loading indicator (spinner or "Thinking…" text) should appear immediately in the chat history as a "pending assistant" message.
- The component should call the `aiCommand` Cloud Function via `fetch` with the user's Firebase ID token and the message text.
- When the response arrives, the loading indicator should be replaced with the assistant's response text.
- The input should be cleared and re-focused after sending.

**Tests (`AiChat.test.jsx` — sending, mock `fetch`):**
- Typing text and pressing Enter adds a user message bubble to the chat history.
- A "Thinking…" indicator appears after sending.
- `fetch` is called with the Cloud Function URL, method POST, correct `Authorization` header, and body containing `boardId`, `message`, and `viewport`.
- On successful response, the "Thinking…" indicator is replaced with the assistant's message text.
- Input is cleared after sending.
- Clicking the Send button has the same behavior as pressing Enter.

#### Error Handling
- If the Cloud Function returns an error, the chat should display the error message in a red-tinted assistant bubble.
- If the network request fails entirely (fetch error), the chat should display "Failed to reach AI service. Check your connection."
- The input should remain enabled after errors so the user can retry.

**Tests (`AiChat.test.jsx` — error handling, mock `fetch`):**
- When `fetch` resolves with `{ success: false, error: "..." }`, the chat shows the error in a red-tinted bubble.
- When `fetch` rejects (network error), the chat shows "Failed to reach AI service. Check your connection."
- After an error, the input field is still enabled (not disabled).

#### Chat History
- Chat history should be stored in component state (not persisted to Firebase).
- Each message should show: role (user/assistant), text content, and timestamp.
- The chat area should auto-scroll to the latest message.
- The chat history should be cleared when the user navigates away or refreshes (ephemeral by design).

**Tests (`AiChat.test.jsx` — chat history):**
- After sending 3 messages and receiving 3 responses, all 6 bubbles are visible in order.
- Each message bubble shows the role (user/assistant) and text content.
- Unmounting and remounting the component starts with an empty chat history.

#### Board Context
- When sending a command, the chat component should also send the user's current viewport center coordinates so the AI can place objects near where the user is looking.
- The message payload to the Cloud Function should be: `{ boardId, message, viewport: { centerX, centerY } }`.

**Tests (`AiChat.test.jsx` — board context):**
- The `fetch` call body includes `viewport.centerX` and `viewport.centerY` matching the viewport prop values.

### Multi-User AI
- When two users issue AI commands simultaneously, each command should execute independently — the Cloud Function is stateless and each invocation reads/writes Firebase directly, so no conflicts occur.
- All board mutations made by the Cloud Function are written to Firebase, so all users see AI-generated results in real-time via existing `onValue` listeners.
- No additional client-side logic is needed for multi-user AI — it falls out of the existing sync architecture.

### Performance
- Single-step AI commands (create one object, change one color) should complete within 2 seconds end-to-end.
- The Cloud Function should use `{ region: 'us-central1' }` (or nearest to the Firebase RTDB) to minimize latency.

---

## Deferred (not required for submission)
- Multiple boards via URL path
- Viewport persistence across refresh (pan/zoom position restored)
- Mobile/touch interactions (pinch-to-zoom, two-finger pan)
