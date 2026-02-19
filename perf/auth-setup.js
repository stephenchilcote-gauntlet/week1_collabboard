/**
 * Extract Firebase auth state from an existing Brave/Chrome profile.
 *
 * Usage:
 *   node perf/auth-setup.js
 *
 * Copies the minimal auth-relevant storage from Brave's "Gauntlet" profile
 * into a temp dir, launches Chromium with it, navigates to the board,
 * and saves Playwright storageState for headless tests.
 *
 * Brave can remain open — we use a copy of the profile.
 */

import { chromium } from '@playwright/test';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = process.env.PERF_BASE_URL || 'https://collabboard-g4-sjc.web.app';
const BOARD = process.env.PERF_BOARD || 'perftest';
const url = `${BASE_URL}/board/${BOARD}/`;

const BRAVE_DATA_DIR = process.env.CHROME_USER_DATA_DIR
  || path.join(os.homedir(), '.config/BraveSoftware/Brave-Browser');
const PROFILE_NAME = process.env.CHROME_PROFILE || 'Profile 105';

async function fromBraveProfile() {
  const profileSrc = path.join(BRAVE_DATA_DIR, PROFILE_NAME);
  const tempUserData = path.join(os.tmpdir(), 'collabboard-perf-userdata');
  const tempProfile = path.join(tempUserData, 'Default'); // Chromium uses "Default" for persistent context

  console.log(`🔐 Copying auth state from Brave profile "${PROFILE_NAME}"...`);

  // Clean up any previous temp profile
  rmSync(tempUserData, { recursive: true, force: true });
  mkdirSync(tempProfile, { recursive: true });

  // Copy only auth-relevant storage
  const toCopy = [
    'IndexedDB',
    'Local Storage',
    'Cookies',
    'Preferences',
  ];

  for (const item of toCopy) {
    const src = path.join(profileSrc, item);
    const dst = path.join(tempProfile, item);
    if (existsSync(src)) {
      cpSync(src, dst, { recursive: true });
      console.log(`   ✓ Copied ${item}`);
    }
  }

  // Also copy the parent-level Local State (needed for encryption keys on some systems)
  const localStateSrc = path.join(BRAVE_DATA_DIR, 'Local State');
  const localStateDst = path.join(tempUserData, 'Local State');
  if (existsSync(localStateSrc)) {
    cpSync(localStateSrc, localStateDst);
    console.log('   ✓ Copied Local State');
  }

  console.log('');
  console.log(`   Launching browser against ${url}...`);

  const context = await chromium.launchPersistentContext(tempUserData, {
    headless: false,
    viewport: { width: 1280, height: 720 },
    // Don't pass --profile-directory since we put everything in "Default"
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(url);

  console.log('   Waiting for board to load...');

  try {
    await page.waitForSelector('[data-testid="board-outer"]', { timeout: 15_000 });
    console.log('✅ Auth carried over successfully — board loaded!');
  } catch {
    console.log('   ⚠ Auth state did not carry over. Sign in manually in the window.');
    console.log('   Waiting up to 2 minutes...');
    await page.waitForSelector('[data-testid="board-outer"]', { timeout: 120_000 });
  }

  await page.waitForTimeout(2000);
  await context.storageState({ path: './perf/auth-state.json' });
  console.log('✅ Auth state saved to perf/auth-state.json');

  await context.close();
  rmSync(tempUserData, { recursive: true, force: true });
}

async function main() {
  try {
    await fromBraveProfile();
  } catch (err) {
    console.error(`\n❌ Failed: ${err.message}`);
    console.log('\nFallback: opening a clean browser for manual sign-in...\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);
    console.log('Sign in with Google, then wait for the board to load...');
    await page.waitForSelector('[data-testid="board-outer"]', { timeout: 120_000 });
    await page.waitForTimeout(2000);
    await context.storageState({ path: './perf/auth-state.json' });
    console.log('✅ Auth state saved to perf/auth-state.json');
    await browser.close();
  }

  console.log('');
  console.log('Run perf tests: npm run perf');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
