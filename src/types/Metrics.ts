export interface Metrics {
  metrics: { [k: string]: MetricGroup };
  histograms: { [k: string]: Histogram };
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
  metric: { [k: string]: string };
  values: Datapoint[];
  name: string;
}

// First is timestamp, second is value
export type Datapoint = [number, number];
