export interface PerformanceTimingsStore {
  [id: string]: number; // Stores start time (milliseconds) for each ID
}

const activeTimers: PerformanceTimingsStore = {};

/**
 * Starts a timer for a given measurement ID.
 * @param id A unique identifier for this measurement.
 */
export const startPerfTimer = (id: string): void => {
  activeTimers[id] = Date.now();
};

/**
 * Ends a timer for a given measurement ID and fixes the duration.
 * @param id The unique identifier for the measurement used with startPerfTimer.
 */
export const endPerfTimer = (id: string): void => {
  const startTime = activeTimers[id];
  if (startTime === undefined) {
    return;
  }
  activeTimers[id] = Date.now() - startTime; // Override the value with the duration
};

/**
 * Retrieves a copy of all currently active timers.
 */
export const getActivePerfTimers = (): PerformanceTimingsStore => {
  return activeTimers;
};

/**
 * Clears a specific active timer.
 * @param id The unique identifier for the measurement.
 */
export const clearPerfTimer = (id: string): void => {
  if (activeTimers[id]) {
    delete activeTimers[id];
  }
};

/**
 * Clears all active timers.
 */
export const clearAllPerfTimers = (): void => {
  for (const id in activeTimers) {
    delete activeTimers[id];
  }
};
