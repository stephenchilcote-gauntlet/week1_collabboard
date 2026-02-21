# CollabBoard

**Live:** [collabboard-g4-sjc.web.app](https://collabboard-g4-sjc.web.app)

Real-time collaborative whiteboard built with React + Firebase. Multiple users create, edit, and manipulate board objects simultaneously with an AI agent that understands natural language.

## Features

- **Board**: Infinite pan/zoom with dot grid, keyboard shortcuts (S/R/C/L/T/F/K/Esc)
- **Objects**: Sticky notes, rectangles, circles, lines, text, frames, connectors, HTML embeds
- **Transforms**: Move, resize, rotate — single and multi-select (shift-click, marquee)
- **Collaboration**: Real-time sync (<100ms), multiplayer cursors with names, presence bar, object locking
- **AI Agent**: Natural language commands — create, manipulate, layout, and query board objects via Claude Sonnet 4
- **Multi-board**: Named boards with URL routing, board picker on landing page
- **Resilience**: Disconnect/reconnect handling, idle timeout, connection status banner

## Architecture

```
Browser (React SPA)
    ↕ WebSocket
Firebase Realtime Database ← canonical state, broadcasts changes
    
Browser → Cloudflare Worker (AI proxy) → Anthropic Claude API
               ↓
           Langfuse (auditing)
```

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), DOM + CSS transforms |
| State | useState + Firebase listeners |
| Database | Firebase Realtime Database |
| Auth | Firebase Auth (Google Sign-In) |
| AI | Claude Sonnet 4 via Cloudflare Worker proxy |
| Auditing | Langfuse |
| Hosting | Firebase Hosting |
| Testing | Vitest + fast-check (property-based) |

## Performance (Playwright automated suite)

| Metric | Target | Measured |
|---|---|---|
| FPS (pan) | 60 | 60 avg, 59.5 p1 |
| FPS (zoom) | 60 | 60 avg, 59.5 p1 |
| FPS (500+ objects) | 60 | 60 avg, 59.5 p1 |
| Object sync latency | <100ms | 50ms median, 58ms max |
| Cursor sync latency | <50ms | 1ms median (local round-trip) |

Run: `npx playwright test --config perf/playwright.config.js` (requires Brave profile with Firebase auth — see `perf/fixtures.js`).

## Getting Started

```bash
cp .env.example .env   # fill in Firebase + AI proxy config
npm install
npm run dev
```

## Tests

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm test
```

## Deployment

```bash
npm run build && npx firebase-tools deploy --only hosting,database
```

## CI/CD

GitHub Actions deploys on `main` to Firebase Hosting and database rules. Configure the repository secret:
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON for the project.

## Firebase

Ensure your `.env` is populated (see `.env.example`) and the Realtime Database rules in `database.rules.json` are deployed.

Sign-in troubleshooting (auth/configuration-not-found):
- Firebase Console > Authentication > Sign-in method > Google > Enable
- Firebase Console > Authentication > Settings > Authorized domains: add `localhost` and your Hosting domain (ex: `collabboard-g4-sjc.web.app`)
- Restart the dev server after updating `.env`
