export interface BaseMetricsOptions {
  rateInterval?: string;
  rateFunc?: string;
  queryTime?: number;
  duration?: number;
  step?: number;
  quantiles?: string[];
  avg?: boolean;
  byLabels?: string[];
}

export interface MetricsOptions extends BaseMetricsOptions {
  filters?: string[];
  reporter: Reporter;
  direction: Direction;
}

export interface CustomMetricsOptions extends BaseMetricsOptions {
  version?: string;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';
