import { auth } from '../firebase/config.js';

export const AI_PROXY_URL =
  import.meta.env.VITE_AI_PROXY_URL ||
  'https://collabboard-ai-proxy.collabboard-sjc.workers.dev';

export const getAuthToken = () => auth.currentUser?.getIdToken() ?? null;
