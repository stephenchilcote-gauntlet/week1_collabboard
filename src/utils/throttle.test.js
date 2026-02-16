import { describe, expect, vi, beforeEach, afterEach } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { throttle } from './throttle.js';

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.prop([
    fc.array(
      fc.record({
        delayMs: fc.integer({ min: 0, max: 200 }),
        value: fc.integer({ min: -1000, max: 1000 }),
      }),
      { minLength: 1, maxLength: 40 },
    ),
    fc.integer({ min: 10, max: 80 }),
  ])('limits calls and preserves the trailing arguments', async (events, intervalMs) => {
    const fn = vi.fn();
    const throttled = throttle(fn, intervalMs);
    let elapsed = 0;

    events.forEach((event) => {
      elapsed += event.delayMs;
      vi.advanceTimersByTime(event.delayMs);
      throttled(event.value);
    });

    vi.advanceTimersByTime(intervalMs + 1);

    const totalDuration = elapsed + intervalMs + 1;
    const maxCalls = Math.ceil(totalDuration / intervalMs) + 1;
    expect(fn.mock.calls.length).toBeLessThanOrEqual(maxCalls);

    const lastArgs = fn.mock.calls.at(-1);
    expect(lastArgs).toEqual([events.at(-1).value]);
  });

  test.prop([
    fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 1, maxLength: 20 }),
    fc.integer({ min: 10, max: 60 }),
  ])('flush executes the most recent pending call', (values, intervalMs) => {
    const fn = vi.fn();
    const throttled = throttle(fn, intervalMs);

    throttled(values[0]);
    values.slice(1).forEach((value) => {
      throttled(value);
    });

    throttled.flush();

    expect(fn.mock.calls.at(-1)).toEqual([values.at(-1)]);
  });
});
