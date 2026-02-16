# CollabBoard Design Document

## What We're Building

A real-time collaborative whiteboard where multiple users can simultaneously create, edit, and move sticky notes and shapes. An AI agent manipulates the board through natural language commands.

---

## MVP Requirements (Hard Gates)

- ☐ Infinite board with pan/zoom
- ☐ Sticky notes with editable text
- ☐ At least one shape type (rectangle, circle, or line)
- ☐ Create, move, and edit objects
- ☐ Real-time sync between 2+ users
- ☐ Multiplayer cursors with name labels
- ☐ Presence awareness (who's online)
- ☐ User authentication
- ☐ Deployed and publicly accessible

Check these off in this file as we progress!

**Timeline:** 12 hours total. MVP must be complete in 24 hours.

---

## Performance Targets

- **Object sync latency:** <100ms
- **Cursor sync latency:** <50ms
- **Frame rate:** 60 FPS during pan/zoom/drag
- **Object capacity:** 500+ objects without degradation
- **Concurrent users:** 5+ without performance issues

---

## Stack Decisions

**Frontend:** React (Vite)  
*Fast dev server and AI coding assistants are extensively trained on React patterns.*

**Rendering:** DOM with native scroll + CSS transforms  
*Browser provides text editing, scrolling, accessibility, and IME support for free.*

**State:** useState + Firebase listeners (no Zustand, no Context)  
*Simplest possible state management—Firebase listeners drive UI updates directly.*

**Database:** Firebase Realtime Database  
*Built-in WebSocket sync with <50ms latency, proven for real-time collaborative apps.*

**Auth:** Firebase Auth (Google Sign-In only)  
*Single-provider auth takes 15 minutes to implement with zero custom UI.*

**Backend:** Firebase Cloud Functions (one function for AI proxy)  
*Hides Anthropic API key, zero ops, serverless auto-scaling.*

**AI:** Anthropic Claude Sonnet 4.5  
*Best-in-class function calling for tool use, 200k context window for complex board states.*

**Hosting:** Firebase Hosting  
*Free tier, integrated with Firebase ecosystem, global CDN, single deployment target.*

**Styling:** Inline styles (no Tailwind, no CSS files)  
*Zero build configuration, no CSS file management, immediate iteration.*

**Testing:** Vitest + Firebase Emulator  
*AI-driven TDD catches sync bugs before manual browser testing.*

---

## Architecture

```
User Browser (React SPA)
    ↓ WebSocket
Firebase Realtime Database (state sync)
    ↓
Firebase Cloud Function (AI proxy)
    ↓
Anthropic Claude API
```

**Frontend responsibility:** Render state, send user actions, display updates optimistically.

**Backend responsibility:** Store canonical state, broadcast changes, handle AI commands.

---

## Data Model

```javascript
{
  boards: {
    'board-id': {
      objects: {
        'obj-1': {
          id: 'obj-1',
          type: 'sticky',           // or 'rectangle'
          x: 100,
          y: 200,
          width: 200,
          height: 150,
          text: 'User Research',    // sticky notes only
          color: '#ffd700',
          updatedAt: 1676543210,
          updatedBy: 'user-xyz'
        }
      },
      cursors: {
        'user-xyz': {
          x: 150,
          y: 250,
          name: 'Alice'
        }
      },
      presence: {
        'user-xyz': {
          uid: 'user-xyz',
          name: 'Alice',
          photoURL: 'https://...',
          online: true
        }
      }
    }
  }
}
```

---

## Sync Strategy

**Optimistic updates:**
- User sees their own edits instantly (local state update)
- Change writes to Firebase asynchronously
- Other users receive update via WebSocket listener

**Conflict resolution:**
- Last-write-wins based on `updatedAt` timestamp
- No operational transforms (acceptable for MVP)

**Keyframes:**
- Optional: Cloud Function writes timestamp every 5s for drift detection
- Not required for MVP

---

## Key Constraints

**Time:** 12 hours total development time.

**Scope:** No TypeScript, no CSS frameworks, no state management libraries, no routing

**Scale:** MVP supports 5 concurrent users. Design for 100 users across 10 boards.

**Cost:** $0-50/month. Firebase free tier sufficient for MVP.

**Security:** No board access control for MVP. Anyone with URL can join.

**Browser:** Desktop Chrome/Firefox/Safari only. No mobile optimization.

---

## AI Agent Requirements

**Minimum 6 command types across:**
- Creation: "Add a yellow sticky note that says 'User Research'"
- Manipulation: "Move all pink sticky notes to the right"
- Layout: "Arrange these notes in a grid"
- Complex: "Create a SWOT analysis template"

**Tool schema:**
```javascript
createStickyNote(text, x, y, color)
createRectangle(x, y, width, height, color)
moveObject(objectId, x, y)
updateText(objectId, newText)
changeColor(objectId, color)
getBoardState() // returns current objects for context
```

**Performance:**
- <2 seconds for single-step commands
- Multi-step commands execute sequentially
- All users see AI-generated objects in real-time

---

## File Structure

```
├── src/
│   ├── components/       # React components (Board, StickyNote, etc.)
│   ├── firebase/
│   │   └── config.js     # Firebase init (db, auth, googleProvider)
│   ├── test/
│   │   └── setup.js      # Vitest setup + Firebase mocks
│   ├── App.jsx           # Root component (auth gate + board)
│   ├── App.test.jsx      # App-level tests
│   └── main.jsx          # Entry point
├── functions/
│   └── index.js          # Cloud Function (AI proxy)
├── firebase.json         # Firebase config (hosting, functions, db rules)
├── database.rules.json   # Realtime DB security rules
├── .env.example          # Required env vars template
└── vite.config.js        # Vite + Vitest config
```

---

## Development Workflow

**AI-driven TDD:**
1. Write spec in plain English
2. Generate user stories (non-technical perspective)
3. AI generates tests from user stories
4. AI generates implementation to pass tests
5. Verify tests pass, commit

**What gets tested:**
- Object sync (create, update, delete)
- Cursor sync
- Presence tracking
- Conflict resolution
- Cloud Function AI handling

We're using Test-Driven Development with AI assistance. For each feature:

Spec - Define what it does in plain English
User Stories - Break into testable scenarios - omit "as a[...]" for just "I" unless story is not from an end user, i.e. "As an auditor, I..."
Tests - AI generates Vitest tests
Code - AI generates implementation
Verify - Tests pass, commit

Use git with feature branches. Follow all standard best practices.

---

## Deployment

```bash
# Build frontend
npm run build

# Deploy everything (hosting + functions + rules)
firebase deploy

# Result: https://PROJECT-ID.web.app
```

**CI/CD:** Git push → manual deploy for MVP. Auto-deploy post-MVP.

---

## Success Criteria

**All must work:**
- ✅ Google Sign-In
- ✅ Create/edit/move sticky notes
- ✅ Create rectangles
- ✅ Real-time sync (<100ms)
- ✅ Multiplayer cursors with names
- ✅ Presence list (who's online)
- ✅ Pan (scroll) + Zoom (Ctrl+Wheel)
- ✅ AI commands via natural language
- ✅ Deployed to public URL
- ✅ Tests pass

**Can be rough:**
- UI styling
- Error messages
- Edge case handling
- Mobile support

---

## Non-Goals (Explicitly Out of Scope)

- TypeScript
- State management library
- CSS framework
- Custom authentication UI
- Board access control
- Offline support
- Undo/redo
- Multi-select
- Color picker
- Animations
- Mobile optimization
- Analytics
- Payment integration
- Email notifications
- Documentation beyond README

## Definition of Done

- All MVP requirements checked off
- Tests pass (`npm test`)
- Works in 2+ browsers simultaneously
- Deployed to public URL
- README with setup instructions
- This design document completed
- TDD workflow documented (AGENTS.md)
