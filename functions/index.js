import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';

initializeApp();

// AI proxy Cloud Function — to be implemented
export const aiCommand = onRequest({ cors: true }, async (req, res) => {
  res.json({ status: 'ok', message: 'AI proxy not yet implemented' });
});
