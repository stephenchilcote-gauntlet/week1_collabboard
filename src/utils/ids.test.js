import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { generateId } from './ids.js';

describe('generateId', () => {
  test.prop([fc.integer({ min: 1, max: 1000 })])('returns unique IDs for a batch', (count) => {
    const ids = Array.from({ length: count }, () => generateId());
    expect(new Set(ids).size).toBe(count);
  });

  test.prop([fc.integer({ min: 1, max: 250 })])('returns Firebase-safe IDs', (count) => {
    const ids = Array.from({ length: count }, () => generateId());
    ids.forEach((id) => {
      expect(/^[^.#$\[\]]+$/.test(id)).toBe(true);
    });
  });
});
