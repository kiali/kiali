// First is timestamp, second is value
export type Datapoint = [number, number];

export interface Metric {
  labels: Labels;
  datapoints: Datapoint[];
  name: string;
  stat?: string;
}

export type IstioMetricsMap = {
  request_count?: Metric[];
  request_error_count?: Metric[];
  request_duration_millis?: Metric[];
  request_throughput?: Metric[];
  response_throughput?: Metric[];
  request_size?: Metric[];
  response_size?: Metric[];
  tcp_received?: Metric[];
  tcp_sent?: Metric[];
};

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

export type LabelDisplayName = string;
export type PromLabel = string;

// Collection of values for a single label, associated to a show/hide flag
export type SingleLabelValues = { [key: string]: boolean };

// Map of all labels (using prometheus name), each with its set of values
export type AllPromLabelsValues = Map<PromLabel, SingleLabelValues>;

export type Labels = {
  [key: string]: string;
};
