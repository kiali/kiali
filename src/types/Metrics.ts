export interface Metrics {
  metrics: { [key: string]: MetricGroup };
  histograms: { [key: string]: Histogram };
}

export type Histogram = { [key: string]: MetricGroup };

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

export enum MetricsObjectTypes {
  SERVICE,
  WORKLOAD,
  APP
}

export interface MetricsStatsResult {
  // Key is built from query params, see StatsComparison.genKey. The same key needs to be generated server-side for matching.
  stats: { [key: string]: MetricsStats };
  // Note: warnings here is for non-blocking errors, it's set when some stats are available, but not all, for instance due to inaccessible namespaces
  // For more serious errors (e.g. prometheus inaccessible) the query would return an HTTP error
  warnings?: string[];
}

export interface MetricsStats {
  responseTimes: Stat[];
}

export interface Stat {
  name: string;
  value: number;
}
