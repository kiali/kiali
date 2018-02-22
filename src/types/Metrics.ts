export interface MetricValue {
  value: number;
}

export interface MetricHistogram {
  average: number;
  median: number;
  percentile95: number;
  percentile99: number;
}
