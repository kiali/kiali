export interface Metrics {
  metrics: Map<String, MetricGroup>;
  histograms: Map<String, Histogram>;
}

export interface Histogram {
  average: MetricGroup;
  median: MetricGroup;
  percentile95: MetricGroup;
  percentile99: MetricGroup;
}

export interface MetricGroup {
  matrix: TimeSeries[];
}

export interface TimeSeries {
  metric: Map<String, String>;
  values: Datapoint[];
  name: string;
}

// First is timestamp, second is value
export type Datapoint = [number, number];
