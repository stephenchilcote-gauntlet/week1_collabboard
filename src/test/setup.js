import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('../firebase/config.js', () => ({
  db: {},
  auth: {
    onAuthStateChanged: vi.fn((callback) => {
      callback(null);
      return vi.fn();
    }),
  },
  googleProvider: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    callback(null);
    return vi.fn();
  }),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  getAuth: vi.fn(),
}));
