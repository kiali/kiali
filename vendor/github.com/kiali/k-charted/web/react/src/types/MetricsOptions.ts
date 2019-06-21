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
