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
  direction: Direction;
  filters?: string[];
  requestProtocol?: string;
  reporter: Reporter;
}

export interface CustomMetricsOptions extends BaseMetricsOptions {
  version?: string;
  rawDataAggregator?: Aggregator;
}

export type Reporter = 'source' | 'destination';
export type Direction = 'inbound' | 'outbound';
export type Aggregator = 'sum' | 'avg' | 'min' | 'max' | 'stddev' | 'stdvar';
