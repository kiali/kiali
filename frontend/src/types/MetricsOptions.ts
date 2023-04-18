import { TargetKind } from './Common';

export interface MetricsQuery {
  rateInterval?: string;
  rateFunc?: string;
  queryTime?: number;
  duration?: number;
  step?: number;
  quantiles?: string[];
  avg?: boolean;
  byLabels?: string[];
}

export interface DashboardQuery extends MetricsQuery {
  rawDataAggregator?: Aggregator;
  labelsFilters?: string;
  additionalLabels?: string;
  workload?: string;
  workloadType?: string;
  cluster?: string;
}

export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'stdvar';

export interface IstioMetricsOptions extends MetricsQuery {
  direction: Direction;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export type Reporter = 'source' | 'destination' | 'both';
export type Direction = 'inbound' | 'outbound';

export interface Target {
  namespace: string;
  name: string;
  kind: TargetKind;
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

export const statsQueryToKey = (q: MetricsStatsQuery) => genStatsKey(q.target, q.peerTarget, q.direction, q.interval);

// !! genStatsKey HAS to mirror backend's models.MetricsStatsQuery#GenKey in models/metrics.go
export const genStatsKey = (target: Target, peer: Target | undefined, direction: string, interval: string): string => {
  const peerKey = peer ? genTargetKey(peer) : '';
  return `${genTargetKey(target)}:${peerKey}:${direction}:${interval}`;
};

const genTargetKey = (target: Target): string => {
  return `${target.namespace}:${target.kind}:${target.name}`;
};
