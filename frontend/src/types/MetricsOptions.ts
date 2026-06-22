import { TargetKind } from './Common';

export interface MetricsQuery {
  avg?: boolean;
  byLabels?: string[];
  duration?: number;
  quantiles?: string[];
  queryTime?: number;
  rateFunc?: string;
  rateInterval?: string;
  step?: number;
}

export interface DashboardQuery extends MetricsQuery {
  additionalLabels?: string;
  labelsFilters?: string;
  rawDataAggregator?: Aggregator;
  workload?: string;
  workloadType?: string;
}

export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'stdvar';

export interface IstioMetricsOptions extends MetricsQuery {
  direction: Direction;
  filters?: string[];
  reporter: string;
  requestProtocol?: string;
}

export type Direction = 'inbound' | 'outbound';
export type StatsReporter = 'source' | 'destination' | 'waypoint';

export interface Target {
  cluster?: string;
  kind: TargetKind;
  name: string;
  namespace: string;
}

export interface MetricsStatsQuery {
  avg: boolean;
  direction: Direction;
  interval: string;
  peerTarget?: Target;
  quantiles: string[];
  queryTime: number;
  reporters?: StatsReporter[];
  target: Target;
}

export const statsQueryToKey = (q: MetricsStatsQuery): string =>
  genStatsKey(q.target, q.peerTarget, q.direction, q.interval, q.reporters);

// !! genStatsKey HAS to mirror backend's models.MetricsStatsQuery#GenKey in models/metrics.go
export const genStatsKey = (
  target: Target,
  peer: Target | undefined,
  direction: Direction,
  interval: string,
  reporters?: StatsReporter[]
): string => {
  const peerKey = peer ? genTargetKey(peer) : '';
  return `${genTargetKey(target)}:${peerKey}:${direction}:${interval}:${normalizeStatsReporters(
    direction,
    reporters
  ).join(',')}`;
};

const genTargetKey = (target: Target): string => {
  return `${target.namespace}:${target.kind}:${target.name}`;
};

export const buildReporter = (direction: Direction, includeWaypoint: boolean): string => {
  const base = direction === 'inbound' ? 'destination' : 'source';
  return includeWaypoint ? `${base},waypoint` : base;
};

export const withWaypoint = (reporter: string, includeWaypoint: boolean): string =>
  includeWaypoint && reporter !== 'both' ? `${reporter},waypoint` : reporter;

export const getStatsReporters = (direction: Direction, includeWaypoint = false): StatsReporter[] => {
  const sideReporter: StatsReporter = direction === 'outbound' ? 'source' : 'destination';
  return includeWaypoint ? [sideReporter, 'waypoint'] : [sideReporter];
};

const normalizeStatsReporters = (direction: Direction, reporters?: StatsReporter[]): StatsReporter[] => {
  const statsReporters = reporters && reporters.length > 0 ? reporters : getStatsReporters(direction);
  return Array.from(new Set(statsReporters)).sort();
};
