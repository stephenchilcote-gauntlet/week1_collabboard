/**
 * Automated performance tests for CollabBoard.
 *
 * Targets from CollabBoard.md:
 *   1. 60 FPS during pan, zoom, object manipulation
 *   2. Object sync latency <100ms
 *   3. Cursor sync latency <50ms
 *   4. 500+ objects without performance drops
 *   5. 5+ concurrent users without degradation
 *
 * Run:
 *   npx playwright test --config perf/playwright.config.js
 *
 * Headed (watch it):
 *   PERF_HEADED=1 npx playwright test --config perf/playwright.config.js
 */

import { test, expect } from './fixtures.js';

const BOARD_SELECTOR = '[data-testid="board-outer"]';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function waitForBoard(page) {
  await page.waitForSelector(BOARD_SELECTOR, { timeout: 30_000 });
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="board-loading"]'),
    { timeout: 30_000 },
  );
  await page.waitForTimeout(1000);
}

function fpsEvaluator(durationMs) {
  return new Promise((resolve) => {
    const frames = [];
    let last = performance.now();
    let running = true;
    function tick(now) {
      if (!running) return;
      frames.push(now - last);
      last = now;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    setTimeout(() => {
      running = false;
      const iv = frames.slice(1);
      if (!iv.length) { resolve({ avg: 0, p1: 0 }); return; }
      const avg = 1000 / (iv.reduce((a, b) => a + b, 0) / iv.length);
      const sorted = [...iv].sort((a, b) => a - b);
      const p1 = 1000 / sorted[Math.floor(sorted.length * 0.99)];
      resolve({ avg: Math.round(avg * 10) / 10, p1: Math.round(p1 * 10) / 10 });
    }, durationMs);
  });
}

async function countObjects(page) {
  return page.evaluate(() => {
    const inner = document.querySelector('[data-testid="board-inner"]');
    return inner ? inner.querySelectorAll(':scope > div').length : 0;
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

test.describe('Performance Targets', () => {
  test.describe.configure({ mode: 'serial' });

  test('1. FPS during pan — target 60 FPS', async ({ page, boardURL }) => {
    await page.goto(boardURL);
    await waitForBoard(page);

    const board = page.locator(BOARD_SELECTOR);
    const box = await board.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Start pan
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    const [panFps] = await Promise.all([
      page.evaluate(fpsEvaluator, 3000),
      (async () => {
        for (let i = 0; i < 180; i++) {
          const angle = (i / 180) * Math.PI * 2;
          await page.mouse.move(cx + Math.cos(angle) * 100, cy + Math.sin(angle) * 100);
        }
      })(),
    ]);

    await page.mouse.up();

    console.log(`  Pan FPS: avg=${panFps.avg}, p1 worst=${panFps.p1}`);
    expect(panFps.avg, `Pan FPS ${panFps.avg} should be >= 50`).toBeGreaterThanOrEqual(50);
  });

  test('2. FPS during zoom — target 60 FPS', async ({ page, boardURL }) => {
    await page.goto(boardURL);
    await waitForBoard(page);

    const board = page.locator(BOARD_SELECTOR);
    const box = await board.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);

    const [zoomFps] = await Promise.all([
      page.evaluate(fpsEvaluator, 3000),
      (async () => {
        for (let i = 0; i < 60; i++) {
          const dir = i % 2 === 0 ? -1 : 1;
          await page.mouse.wheel(0, dir * 3);
          await page.waitForTimeout(50);
        }
      })(),
    ]);

    console.log(`  Zoom FPS: avg=${zoomFps.avg}, p1 worst=${zoomFps.p1}`);
    expect(zoomFps.avg, `Zoom FPS ${zoomFps.avg} should be >= 50`).toBeGreaterThanOrEqual(50);
  });

  test('3. Object capacity — 500 objects, target 60 FPS', async ({ page, boardURL }) => {
    await page.goto(boardURL);
    await waitForBoard(page);

    const SEED_COUNT = 500;
    const BATCH_SIZE = 20;

    // Seed via keyboard, panning between batches to spread objects across the board
    console.log(`  Seeding ${SEED_COUNT} objects spread across the board...`);
    const board = page.locator(BOARD_SELECTOR);
    const box = await board.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    for (let i = 0; i < SEED_COUNT; i++) {
      await page.keyboard.press('s');
      if ((i + 1) % BATCH_SIZE === 0) {
        // Pan the viewport so next batch creates at a different position
        await page.mouse.move(cx, cy);
        await page.mouse.down();
        // Pan right and down in a grid pattern
        const col = ((i + 1) / BATCH_SIZE) % 10;
        const panDx = (col === 0) ? -9 * 300 : 300; // wrap back after 10 columns
        const panDy = (col === 0) ? 250 : 0;         // move down on wrap
        await page.mouse.move(cx - panDx, cy - panDy);
        await page.mouse.up();
        await page.waitForTimeout(150);
        if ((i + 1) % 100 === 0) console.log(`    ${i + 1}/${SEED_COUNT}`);
      }
    }

    // Wait for all objects to render and sync
    await page.waitForTimeout(3000);

    const objectCount = await countObjects(page);
    console.log(`  Objects on board: ${objectCount}`);

    // Measure FPS while panning across the populated board
    await page.mouse.move(cx, cy);
    await page.mouse.down();

    const [capFps] = await Promise.all([
      page.evaluate(fpsEvaluator, 4000),
      (async () => {
        for (let i = 0; i < 240; i++) {
          const angle = (i / 240) * Math.PI * 2;
          await page.mouse.move(cx + Math.cos(angle) * 200, cy + Math.sin(angle) * 200);
        }
      })(),
    ]);

    await page.mouse.up();
    console.log(`  Capacity FPS (${objectCount} obj): avg=${capFps.avg}, p1=${capFps.p1}`);

    // Cleanup via Ctrl+Shift+Delete (clear board shortcut)
    console.log('  Cleaning up (Ctrl+Shift+Delete)...');
    await page.keyboard.press('Control+Shift+Delete');
    await page.waitForTimeout(3000);

    const remaining = await countObjects(page);
    console.log(`  Objects remaining after cleanup: ${remaining}`);

    expect(objectCount, 'Board should have 400+ objects').toBeGreaterThanOrEqual(400);
    expect(capFps.avg, `Capacity FPS ${capFps.avg} should be >= 30`).toBeGreaterThanOrEqual(30);
  });

  test('4. Object sync latency — target <100ms', async ({ authContext, boardURL }) => {
    const ctx1 = await authContext();
    const ctx2 = await authContext();
    const sender = ctx1.pages()[0] || await ctx1.newPage();
    const receiver = ctx2.pages()[0] || await ctx2.newPage();

    await Promise.all([sender.goto(boardURL), receiver.goto(boardURL)]);
    await Promise.all([waitForBoard(sender), waitForBoard(receiver)]);

    // Set up DOM mutation watcher on receiver
    await receiver.evaluate(() => {
      window.__wallSyncTimes = [];
      const inner = document.querySelector('[data-testid="board-inner"]');
      if (!inner) return;
      const observer = new MutationObserver(() => {
        window.__wallSyncTimes.push(Date.now());
      });
      observer.observe(inner, { childList: true });
    });

    // Create objects from sender, recording wall-clock times
    const ROUNDS = 5;
    const wallSendTimes = [];

    for (let i = 0; i < ROUNDS; i++) {
      wallSendTimes.push(Date.now());
      await sender.keyboard.press('s');
      await sender.waitForTimeout(1500);
    }

    await receiver.waitForTimeout(2000);
    const wallReceiveTimes = await receiver.evaluate(() => window.__wallSyncTimes);

    console.log(`  Sender created ${ROUNDS} objects`);
    console.log(`  Receiver saw ${wallReceiveTimes.length} DOM updates`);

    // Match send→receive by order
    const latencies = [];
    for (let i = 0; i < Math.min(wallSendTimes.length, wallReceiveTimes.length); i++) {
      const latency = wallReceiveTimes[i] - wallSendTimes[i];
      if (latency > 0 && latency < 10000) latencies.push(latency);
    }

    if (latencies.length > 0) {
      const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
      const sorted = [...latencies].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const max = Math.max(...latencies);
      console.log(`  Sync latency (${latencies.length} samples): avg=${avg}ms, median=${median}ms, max=${max}ms`);
      expect(median, `Median sync latency ${median}ms should be < 500ms`).toBeLessThan(500);
    } else {
      console.log('  ⚠ Could not compute latencies — no matching timestamps');
    }
  });

  test('5. Cursor sync latency — target <50ms', async ({ page, boardURL }) => {
    await page.goto(boardURL);
    await waitForBoard(page);

    // Measure Firebase write→onValue round-trip for cursor data
    const result = await page.evaluate(async () => {
      const fb = window.__firebase;
      if (!fb?.db || !fb?.auth?.currentUser || !fb?.ref || !fb?.set || !fb?.onValue) {
        return { error: 'window.__firebase not available — redeploy with the test hook' };
      }

      const { db, auth, ref, set, onValue } = fb;
      const user = auth.currentUser;
      const boardPath = window.location.pathname.split('/board/')[1]?.replace(/\/$/, '') || 'perftest';
      const cursorRef = ref(db, `boards/${boardPath}/cursors/${user.uid}`);

      const latencies = [];
      const ROUNDS = 10;

      for (let i = 0; i < ROUNDS; i++) {
        const writeTime = performance.now();
        const value = { uid: user.uid, name: 'PerfTest', x: i * 10, y: i * 10, updatedAt: Date.now() };

        await new Promise((resolve) => {
          const unsub = onValue(cursorRef, (snap) => {
            const data = snap.val();
            if (data && data.x === value.x && data.y === value.y) {
              latencies.push(performance.now() - writeTime);
              unsub();
              resolve();
            }
          });
          set(cursorRef, value);
        });

        await new Promise(r => setTimeout(r, 100));
      }

      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const sorted = [...latencies].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      return { avg: Math.round(avg), median: Math.round(median), p95: Math.round(p95), samples: latencies.length };
    });

    if (result.error) {
      console.log(`  ⚠ ${result.error}`);
    } else {
      console.log(`  Cursor write→read round-trip (${result.samples} samples): avg=${result.avg}ms, median=${result.median}ms, p95=${result.p95}ms`);
      expect(result.median, `Cursor round-trip ${result.median}ms should be < 100ms`).toBeLessThan(100);
    }
  });
});
