import { MetricsQuery } from '@kiali/k-charted-pf4';
import { TargetKind } from './Common';

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
