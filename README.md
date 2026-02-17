# CollabBoard

Real-time collaborative whiteboard built with React + Firebase. Supports multi-user cursors, presence, sticky notes, rectangles, and real-time object sync.

## Features
- Infinite pan/zoom board with dot grid
- Sticky notes with inline text editing
- Rectangles with resize handles
- Multi-user cursors and presence bar
- Remote change perception (new object highlight, remote drag labels, off-screen notifications)
- Connection status banner

## Getting Started

```bash
npm install
npm run dev
```

## Tests

Vitest can be memory-intensive in this repo. Run with:

```bash
NODE_OPTIONS=--max-old-space-size=4096 npm test
```

## Deployment

```bash
npm run build
firebase deploy
```

## Firebase

Update Firebase config in `src/firebase/config.js` and ensure the Realtime Database rules in `database.rules.json` are deployed.
