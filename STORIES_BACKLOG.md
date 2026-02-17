# STORIES_BACKLOG.md — Post-MVP User Stories

Stories use "I should…" / "When I…" format. "I" = the end user unless stated otherwise.

---

## AI Board Agent

### Chat Interface
- I should see an AI chat input (text field or panel) accessible from the board UI without leaving the board.
- When I type a command and submit, I should see a loading/thinking indicator while the AI processes.
- When the AI completes, I should see the result on the board and a confirmation message in the chat.
- If the AI fails or doesn't understand my command, I should see a clear error message — not a silent failure or a broken board state.

### Creation Commands
- When I say "Add a yellow sticky note that says 'User Research'", a yellow sticky note with that text should appear on the board.
- When I say "Create a blue rectangle at position 100, 200", a blue rectangle should appear at approximately that position.
- When I say "Add a frame called 'Sprint Planning'", a labeled frame should appear on the board.
- Created objects should appear via the same Firebase sync path as manually-created objects — all users see them in real-time.

### Manipulation Commands
- When I say "Move all the pink sticky notes to the right side", the AI should identify pink sticky notes and reposition them.
- When I say "Change the sticky note color to green", the AI should change the targeted note's color (or ask for clarification if ambiguous).
- When I say "Delete all the rectangles", the AI should remove them.

### Layout Commands
- When I say "Arrange these sticky notes in a grid", the AI should reposition them into an evenly-spaced grid.
- When I say "Create a 2x3 grid of sticky notes for pros and cons", the AI should create 6 sticky notes arranged in a grid with appropriate labels.
- When I say "Space these elements evenly", the AI should redistribute objects with consistent gaps.

### Complex / Template Commands
- When I say "Create a SWOT analysis", the AI should create 4 labeled quadrants (Strengths, Weaknesses, Opportunities, Threats) using frames or rectangles with sticky notes or labels.
- When I say "Set up a retrospective board", the AI should create columns for "What Went Well", "What Didn't", and "Action Items".
- Multi-step commands should execute sequentially — partial results appearing as each step completes is acceptable.

### Board Context
- The AI should be able to read the current board state (via `getBoardState()`) to make contextual decisions (e.g., knowing where existing objects are to avoid overlap).
- When the AI creates objects, it should place them in unoccupied space when no position is specified.

### Multi-User AI
- When two users issue AI commands simultaneously, both should execute without conflict — results should not overwrite each other.
- All users should see AI-generated objects appear in real-time, same as manually created objects.

### Performance
- Single-step AI commands (create one object, change one color) should complete within 2 seconds.
- The AI should support at least 6 distinct command types across creation, manipulation, layout, and complex categories.

### Security
- The Anthropic API key must never be exposed to the client. All AI calls go through a Firebase Cloud Function proxy.
- The Cloud Function should validate that the caller is authenticated before processing AI requests.

---

## Additional Post-MVP Features
- Undo/redo
- Multi-select (shift-click, drag-to-select)
- Copy/paste/duplicate
- Connectors/arrows between objects
- Frames
- Standalone text elements
- Rotation
- Multiple boards via URL path
- Viewport persistence across refresh (pan/zoom position restored)
- Mobile/touch interactions (pinch-to-zoom, two-finger pan)
