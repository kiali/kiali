interface MetricsOptions {
  rateInterval?: string;
  rateFunc?: string;
  queryTime?: number;
  duration?: number;
  step?: number;
  version?: string;
  filters?: string[];
  quantiles?: string[];
  avg?: boolean;
  byLabels?: string[];
  reporter: Reporter;
  direction: Direction;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';

export default MetricsOptions;
