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

## CI/CD

GitHub Actions deploys on `main` to Firebase Hosting and database rules. Configure the repository secret:
- `FIREBASE_SERVICE_ACCOUNT`: Firebase service account JSON for the project.

## Firebase

Ensure your `.env` is populated (see `.env.example`) and the Realtime Database rules in `database.rules.json` are deployed.

Sign-in troubleshooting (auth/configuration-not-found):
- Firebase Console > Authentication > Sign-in method > Google > Enable
- Firebase Console > Authentication > Settings > Authorized domains: add `localhost` and your Hosting domain (ex: `collabboard-g4-sjc.web.app`)
- Restart the dev server after updating `.env`
