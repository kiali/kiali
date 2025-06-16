export interface PerformanceTimingsStore {
  [id: string]: number; // Stores start time (milliseconds) for each ID
}

export interface PerformanceMetricStats {
  allTimesMs: number[];
  avgTimeMs: number;
  count: number;
  id: string;
  maxTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
  totalTimeMs: number;
}

export interface SimplifiedPerfStats {
  avgTimeMs: number;
  maxTimeMs: number;
  medianTimeMs: number;
  minTimeMs: number;
}

export interface AllPerformanceStatsStore {
  [id: string]: PerformanceMetricStats;
}

const activeTimers: PerformanceTimingsStore = {};
const collectedStats: AllPerformanceStatsStore = {};

/**
 * Helper function to calculate the median from an array of numbers.
 * @param times Array of numbers (durations).
 * @returns The median value.
 */
const calculateMedian = (times: number[]): number => {
  if (!times || times.length === 0) {
    return 0;
  }

  const sortedTimes = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sortedTimes.length / 2);

  if (sortedTimes.length % 2 === 0) {
    return (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;
  }
  return sortedTimes[mid];
};

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

  // Initialize stats for this ID if it's the first time
  if (!collectedStats[id]) {
    collectedStats[id] = {
      id: id,
      count: 0,
      totalTimeMs: 0,
      minTimeMs: Infinity, // Initialize min to a very high value
      maxTimeMs: -Infinity, // Initialize max to a very low value
      avgTimeMs: 0,
      medianTimeMs: 0,
      allTimesMs: []
    };
  }

  // Update statistics
  const stats = collectedStats[id];
  stats.count++;
  stats.totalTimeMs += activeTimers[id];
  stats.minTimeMs = Math.min(stats.minTimeMs, activeTimers[id]);
  stats.maxTimeMs = Math.max(stats.maxTimeMs, activeTimers[id]);
  stats.avgTimeMs = Math.round(stats.totalTimeMs / stats.count);
  stats.allTimesMs.push(activeTimers[id]);
  stats.medianTimeMs = Math.round(calculateMedian(stats.allTimesMs));

  delete activeTimers[id]; // Clean up the active timer
};

/**
 * Retrieves a read-only copy of the statistics for a specific ID.
 * @param id The request ID.
 * @returns A copy of the statistics object, or undefined if no stats for that ID.
 */
export const getPerfStatsForId = (id: string): { [key: string]: SimplifiedPerfStats } | undefined => {
  if (collectedStats[id]) {
    const stats = collectedStats[id];
    const reportStats: SimplifiedPerfStats = {
      minTimeMs: stats.minTimeMs,
      maxTimeMs: stats.maxTimeMs,
      avgTimeMs: stats.avgTimeMs,
      medianTimeMs: stats.medianTimeMs
    };
    const result: { [key: string]: SimplifiedPerfStats } = {};
    result[id] = reportStats;
    return result;
  }
  return undefined; // No stats found for this request ID
};

/**
 * Retrieves all collected performance statistics, with each ID mapping to its
 * simplified statistics (min, max, avg, median).
 * This version calls the modified getPerfStatsForId in a loop.
 *
 * @returns An object where keys are request IDs and values are their simplified statistics.
 */
export const getAllPerfStats = (): { [key: string]: SimplifiedPerfStats } => {
  const allSimplifiedStatsResult: { [key: string]: SimplifiedPerfStats } = {};

  for (const id in collectedStats) {
    Object.assign(allSimplifiedStatsResult, getPerfStatsForId(id));
  }
  return allSimplifiedStatsResult;
};

/**
 * Resets (clears) the statistics for a specific ID.
 * @param id The performance timer ID.
 */
export const resetPerfStatsForId = (id: string): void => {
  if (collectedStats[id]) {
    delete collectedStats[id];
  }
};

/**
 * Resets all collected performance statistics.
 */
export const resetAllPerfStats = (): void => {
  for (const id in collectedStats) {
    delete collectedStats[id];
  }
};
