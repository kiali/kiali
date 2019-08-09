import { MetricsQuery } from '@kiali/k-charted-pf4';

export interface IstioMetricsOptions extends MetricsQuery {
  direction: Direction;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';
