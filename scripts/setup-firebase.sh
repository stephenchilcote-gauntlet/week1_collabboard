#!/bin/bash
# Run this after: npx firebase-tools login
# Usage: ./scripts/setup-firebase.sh <project-id>

set -e

PROJECT_ID="${1:?Usage: ./scripts/setup-firebase.sh <project-id>}"

echo "==> Setting active project to: $PROJECT_ID"
npx firebase-tools use "$PROJECT_ID"

echo "==> Fetching web app config..."
# Create a web app if none exists
APP_LIST=$(npx firebase-tools apps:list WEB --project "$PROJECT_ID" --json 2>/dev/null)
APP_COUNT=$(echo "$APP_LIST" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d).result||[]; console.log(r.length)")

if [ "$APP_COUNT" = "0" ]; then
  echo "==> Creating web app 'CollabBoard'..."
  npx firebase-tools apps:create WEB CollabBoard --project "$PROJECT_ID"
fi

# Get the SDK config
echo "==> Extracting SDK config..."
APP_ID=$(npx firebase-tools apps:list WEB --project "$PROJECT_ID" --json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d).result||[]; console.log(r[0]?.appId||'')")

if [ -z "$APP_ID" ]; then
  echo "ERROR: Could not find web app ID"
  exit 1
fi

CONFIG_JSON=$(npx firebase-tools apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" --json)

# Extract values and write .env
node -e "
const config = JSON.parse(process.argv[1]).result.sdkConfig;
const lines = [
  'VITE_FIREBASE_API_KEY=' + config.apiKey,
  'VITE_FIREBASE_AUTH_DOMAIN=' + config.authDomain,
  'VITE_FIREBASE_DATABASE_URL=' + (config.databaseURL || ''),
  'VITE_FIREBASE_PROJECT_ID=' + config.projectId,
  'VITE_FIREBASE_STORAGE_BUCKET=' + (config.storageBucket || ''),
  'VITE_FIREBASE_MESSAGING_SENDER_ID=' + config.messagingSenderId,
  'VITE_FIREBASE_APP_ID=' + config.appId,
];
require('fs').writeFileSync('.env', lines.join('\n') + '\n');
console.log('==> .env written successfully!');
console.log(lines.map(l => l.split('=')[0] + '=' + l.split('=')[1].substring(0,8) + '...').join('\n'));
" "$CONFIG_JSON"

echo ""
echo "==> Done! Next steps if .env is missing databaseURL:"
echo "    1. Go to Firebase Console > Realtime Database > Create Database"
echo "    2. Add VITE_FIREBASE_DATABASE_URL=https://${PROJECT_ID}-default-rtdb.firebaseio.com to .env"
echo ""
echo "==> Also enable Google Auth:"
echo "    Firebase Console > Authentication > Sign-in method > Google > Enable"
