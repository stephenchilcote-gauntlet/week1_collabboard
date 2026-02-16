export const throttle = (fn, intervalMs) => {
  let lastRun = 0;
  let timeoutId = null;
  let pendingArgs = null;

  const invoke = (args) => {
    lastRun = Date.now();
    fn(...args);
  };

  const scheduleTrailing = () => {
    if (timeoutId !== null) {
      return;
    }

    const delay = Math.max(intervalMs - (Date.now() - lastRun), 0);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (pendingArgs) {
        const args = pendingArgs;
        pendingArgs = null;
        invoke(args);
      }
    }, delay);
  };

  const throttled = (...args) => {
    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed >= intervalMs || lastRun === 0) {
      pendingArgs = null;
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      invoke(args);
      return;
    }

    pendingArgs = args;
    scheduleTrailing();
  };

  throttled.flush = () => {
    if (!pendingArgs) {
      return;
    }

    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }

    const args = pendingArgs;
    pendingArgs = null;
    invoke(args);
  };

  return throttled;
};
