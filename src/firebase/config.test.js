import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ app: true })),
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({ db: true })),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ auth: true })),
  GoogleAuthProvider: vi.fn(() => ({ provider: true })),
}));

describe('firebase config', () => {
  beforeEach(() => {
    Object.assign(import.meta.env, {
      VITE_FIREBASE_API_KEY: 'test-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'test-auth-domain',
      VITE_FIREBASE_DATABASE_URL: 'https://example.firebaseio.com',
      VITE_FIREBASE_PROJECT_ID: 'test-project',
      VITE_FIREBASE_STORAGE_BUCKET: 'test-bucket',
      VITE_FIREBASE_MESSAGING_SENDER_ID: 'test-sender',
      VITE_FIREBASE_APP_ID: 'test-app',
    });
  });

  it('exports the default board id', async () => {
    const { BOARD_ID } = await import('./config.js');
    expect(BOARD_ID).toBe('default');
  });
});
