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
  includeAmbient: boolean;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export type Reporter = 'source' | 'destination' | 'both';
export type Direction = 'inbound' | 'outbound';

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
  target: Target;
}

export const statsQueryToKey = (q: MetricsStatsQuery): string =>
  genStatsKey(q.target, q.peerTarget, q.direction, q.interval);

// !! genStatsKey HAS to mirror backend's models.MetricsStatsQuery#GenKey in models/metrics.go
export const genStatsKey = (target: Target, peer: Target | undefined, direction: string, interval: string): string => {
  const peerKey = peer ? genTargetKey(peer) : '';
  return `${genTargetKey(target)}:${peerKey}:${direction}:${interval}`;
};

const genTargetKey = (target: Target): string => {
  return `${target.namespace}:${target.kind}:${target.name}`;
};
