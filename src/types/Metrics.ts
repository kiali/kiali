export interface Metrics {
  metrics: { [key: string]: MetricGroup };
  histograms: { [key: string]: Histogram };
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

export type Metric = {
  [key: string]: string;
};

export interface TimeSeries {
  metric: Metric;
  values: Datapoint[];
  name: string;
}

// First is timestamp, second is value
export type Datapoint = [number, number];
