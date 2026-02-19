/**
 * Shared Playwright fixtures that provide an authenticated browser context
 * by copying the Brave "Gauntlet" profile's auth storage.
 *
 * Firebase stores auth tokens in IndexedDB, which Playwright's storageState
 * doesn't capture. We work around this by copying the profile and using
 * launchPersistentContext.
 */

import { test as base, chromium } from '@playwright/test';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

const BRAVE_DATA_DIR = process.env.CHROME_USER_DATA_DIR
  || path.join(os.homedir(), '.config/BraveSoftware/Brave-Browser');
const PROFILE_NAME = process.env.CHROME_PROFILE || 'Profile 105';

const BASE_URL = process.env.PERF_BASE_URL || 'https://collabboard-g4-sjc.web.app';
const BOARD = process.env.PERF_BOARD || 'perftest';

function copyProfile(destDir) {
  const profileSrc = path.join(BRAVE_DATA_DIR, PROFILE_NAME);

  rmSync(destDir, { recursive: true, force: true });
  const defaultDir = path.join(destDir, 'Default');
  mkdirSync(defaultDir, { recursive: true });

  for (const item of ['IndexedDB', 'Local Storage', 'Cookies', 'Preferences']) {
    const src = path.join(profileSrc, item);
    if (existsSync(src)) {
      cpSync(src, path.join(defaultDir, item), { recursive: true });
    }
  }

  const localState = path.join(BRAVE_DATA_DIR, 'Local State');
  if (existsSync(localState)) {
    cpSync(localState, path.join(destDir, 'Local State'));
  }
}

/** Counter to give each worker/context its own temp dir. */
let contextCounter = 0;

export const test = base.extend({
  // Override the default `context` fixture to use a persistent context
  // with the copied Brave profile.
  context: async ({}, use) => {
    const tempDir = path.join(os.tmpdir(), `collabboard-perf-${process.pid}-${contextCounter++}`);
    copyProfile(tempDir);

    const context = await chromium.launchPersistentContext(tempDir, {
      headless: !process.env.PERF_HEADED,
      viewport: { width: 1280, height: 720 },
    });

    await use(context);

    await context.close();
    rmSync(tempDir, { recursive: true, force: true });
  },

  // Override the default `page` fixture to use the persistent context's page.
  page: async ({ context }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },

  // Convenience: authenticated browser for tests that need two separate contexts
  // (e.g., sync latency). Returns a factory function.
  authContext: async ({}, use) => {
    const contexts = [];

    const factory = async () => {
      const tempDir = path.join(os.tmpdir(), `collabboard-perf-${process.pid}-${contextCounter++}`);
      copyProfile(tempDir);
      const ctx = await chromium.launchPersistentContext(tempDir, {
        headless: !process.env.PERF_HEADED,
        viewport: { width: 1280, height: 720 },
      });
      contexts.push({ ctx, tempDir });
      return ctx;
    };

    await use(factory);

    for (const { ctx, tempDir } of contexts) {
      await ctx.close();
      rmSync(tempDir, { recursive: true, force: true });
    }
  },

  boardURL: `${BASE_URL}/board/${BOARD}/`,
});

export { expect } from '@playwright/test';
