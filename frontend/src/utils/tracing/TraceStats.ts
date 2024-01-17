import { EnvoySpanInfo, JaegerTrace, RichSpanData } from 'types/TracingInfo';
import { MetricsStats } from 'types/Metrics';
import { genStatsKey, MetricsStatsQuery, statsQueryToKey } from 'types/MetricsOptions';
import { average } from '../MathUtils';

export const averageSpanDuration = (trace: JaegerTrace): number | undefined => {
  const spansWithDuration = trace.spans.filter(s => s.duration && s.duration > 0);
  return average(spansWithDuration, span => span.duration);
};

export const isSimilarTrace = (t1: JaegerTrace, t2: JaegerTrace): boolean => {
  if (t1.spans.length === 0 || t2.spans.length === 0) {
    // Shouldn't happen... but avoid /0 anyway
    return false;
  }
  // Similarity algorithm:
  //  First criteria: if numbers of spans are close
  //  Second criteria: we'll count the number of occurrences of operations per trace, and look at the highest occuring operations.
  //  The closest their count are, the more similar the traces are.
  const nbSpansScore = distanceScore(t1.spans.length, t2.spans.length);
  type OpOccur = { op: string; t1: number; t2: number };
  const countOperations = new Map<String, OpOccur>();
  t1.spans.forEach(s => {
    const counter = countOperations.get(s.operationName);
    if (counter) {
      counter.t1++;
    } else {
      countOperations.set(s.operationName, { op: s.operationName, t1: 1, t2: 0 });
    }
  });
  t2.spans.forEach(s => {
    const counter = countOperations.get(s.operationName);
    if (counter) {
      counter.t2++;
    } else {
      countOperations.set(s.operationName, { op: s.operationName, t1: 0, t2: 1 });
    }
  });
  const values = Array.from(countOperations.values());
  const operationSimilarityScore = (counterGetter: (counter: OpOccur) => number): number => {
    const sorted = values.sort((a, b) => counterGetter(b) - counterGetter(a));
    let score = 0;
    const total = Math.min(4, sorted.length);
    for (let i = 0; i < total; i++) {
      score += distanceScore(sorted[i].t1, sorted[i].t2);
    }
    return score / total;
  };
  const score1 = operationSimilarityScore(counter => counter.t1);
  const score2 = operationSimilarityScore(counter => counter.t2);
  const total = (nbSpansScore + score1 + score2) / 3;
  // Arbitrary threshold: score below 0.3 means "similar"
  return total < 0.3;
};

const distanceScore = (n1: number, n2: number): number => {
  // Some score of how two numbers are "close" to each other
  return Math.abs(n1 - n2) / Math.max(1, Math.max(n1, n2));
};
const statsQuantiles = ['0.5', '0.9', '0.99'];
const compactStatsQuantiles = ['0.5', '0.9'];
export const statsQuantilesWithAvg = ['avg', ...statsQuantiles];
export const statsIntervals = ['10m', '60m', '3h'];
export const compactStatsQuantilesWithAvg = ['avg', ...compactStatsQuantiles];
export const compactStatsIntervals = ['60m', '3h'];
export const statsPerPeer = false;
export let statsCompareKind: 'app' | 'workload' = 'workload';

export const buildQueriesFromSpans = (items: RichSpanData[], isCompact: boolean) => {
  const queryTime = Math.floor(Date.now() / 1000);
  // Load stats for up to 8 spans to limit the heavy loading. More stats can be loaded individually.
  const queries = items
    .filter(s => s.type === 'envoy')
    .slice(0, 8)
    .flatMap(item => {
      const info = item.info as EnvoySpanInfo;
      if (!info.direction) {
        console.warn('Could not determine direction from Envoy span.');
        return [];
      }
      if (statsPerPeer && !info.peer) {
        console.warn('Could not determine peer from Envoy span.');
        return [];
      }
      const name = statsCompareKind === 'app' ? item.app : item.workload;
      if (!name) {
        console.warn('Could not determine workload from Envoy span.');
        return [];
      }
      const query: MetricsStatsQuery = {
        avg: true,
        direction: info.direction,
        interval: '', // placeholder
        peerTarget: statsPerPeer ? info.peer : undefined,
        quantiles: isCompact ? compactStatsQuantiles : statsQuantiles,
        queryTime: queryTime,
        target: {
          namespace: item.namespace,
          name: name,
          kind: statsCompareKind,
          cluster: item.cluster
        }
      };
      return (isCompact ? compactStatsIntervals : statsIntervals).map(interval => ({ ...query, interval: interval }));
    });
  return deduplicateMetricQueries(queries);
};

const deduplicateMetricQueries = (queries: MetricsStatsQuery[]) => {
  // Exclude redundant queries based on this keygen as a merger, + hashmap
  const dedup = new Map<string, MetricsStatsQuery>();
  queries.forEach(q => {
    const key = statsQueryToKey(q);
    if (key) {
      dedup.set(key, q);
    }
  });
  return Array.from(dedup.values());
};

export type StatsWithIntervalIndex = MetricsStats & { intervalIndex: number };
export type StatsMatrix = (number | undefined)[][];
export const initStatsMatrix = (intervals: string[]): StatsMatrix => {
  return new Array(statsQuantilesWithAvg.length)
    .fill(0)
    .map(() => new Array(intervals.length).fill(0).map(() => undefined));
};

export const statsToMatrix = (itemStats: StatsWithIntervalIndex[], intervals: string[]): StatsMatrix => {
  const matrix = initStatsMatrix(intervals);
  itemStats.forEach(stats => {
    stats.responseTimes.forEach(stat => {
      const x = statsQuantilesWithAvg.indexOf(stat.name);
      if (x >= 0) {
        matrix[x][stats.intervalIndex] = stat.value;
      }
    });
  });
  return matrix;
};

export const getSpanStats = (
  item: RichSpanData,
  metricsStats: Map<string, MetricsStats>,
  isCompact: boolean
): StatsWithIntervalIndex[] => {
  const intervals = isCompact ? compactStatsIntervals : statsIntervals;

  return intervals.flatMap((interval, intervalIndex) => {
    const info = item.info as EnvoySpanInfo;
    const target = {
      namespace: item.namespace,
      name: statsCompareKind === 'app' ? item.app : item.workload!,
      kind: statsCompareKind,
      cluster: item.cluster
    };
    const key = genStatsKey(target, statsPerPeer ? info.peer : undefined, info.direction!, interval);
    if (key) {
      const stats = metricsStats.get(key);
      if (stats) {
        const baseLine = item.duration / 1000;
        const statsDiff = stats.responseTimes.map(stat => {
          return { name: stat.name, value: baseLine - stat.value };
        });
        return [{ responseTimes: statsDiff, isCompact: isCompact, intervalIndex: intervalIndex }];
      }
    }
    return [];
  });
};

export const reduceMetricsStats = (trace: JaegerTrace, allStats: Map<string, MetricsStats>, isCompact: boolean) => {
  let isComplete = true;
  const intervals = isCompact ? compactStatsIntervals : statsIntervals;
  const quantilesWithAvg = isCompact ? compactStatsQuantilesWithAvg : statsQuantilesWithAvg;

  // Aggregate all spans stats, per stat name/interval, into a temporary map
  type AggregatedStat = { name: string; intervalIndex: number; values: number[] };
  const aggregatedStats = new Map<string, AggregatedStat>();
  trace.spans
    .filter(s => s.type === 'envoy')
    .forEach(span => {
      const spanStats = getSpanStats(span, allStats, isCompact);
      if (spanStats.length > 0) {
        spanStats.forEach(statsPerInterval => {
          statsPerInterval.responseTimes.forEach(stat => {
            const aggKey = stat.name + '@' + statsPerInterval.intervalIndex;
            const aggStat = aggregatedStats.get(aggKey);
            if (aggStat) {
              aggStat.values.push(stat.value);
            } else {
              aggregatedStats.set(aggKey, {
                name: stat.name,
                intervalIndex: statsPerInterval.intervalIndex,
                values: [stat.value]
              });
            }
          });
        });
      } else {
        isComplete = false;
      }
    });
  // Convert the temporary map into a matrix
  const matrix = initStatsMatrix(intervals);
  aggregatedStats.forEach(aggStat => {
    // compute mean per stat
    const x = quantilesWithAvg.indexOf(aggStat.name);
    if (x >= 0) {
      const len = aggStat.values.length;
      if (len > 0) {
        matrix[x][aggStat.intervalIndex] = aggStat.values.reduce((p, c) => p + c, 0) / len;
      }
    }
  });
  return { matrix: matrix, isComplete: isComplete };
};
