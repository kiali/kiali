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
}

export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'stdvar';

export interface IstioMetricsOptions extends MetricsQuery {
  direction: Direction;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';

export interface Target {
  namespace: string;
  name: string;
  kind: TargetKind;
}

export interface MetricsStatsQuery {
  target: Target;
  peerTarget?: Target;
  queryTime: number;
  interval: string;
  direction: Direction;
  avg: boolean;
  quantiles: string[];
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
