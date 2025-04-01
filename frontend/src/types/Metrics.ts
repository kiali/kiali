// First is timestamp, second is value, third is y0
export type Datapoint = [number, number, number?];

export interface Metric {
  datapoints: Datapoint[];
  labels: Labels;
  name: string;
  stat?: string;
}

export type ControlPlaneMetricsMap = {
  istiod_container_cpu?: Metric[];
  istiod_container_mem?: Metric[];
  istiod_process_cpu?: Metric[];
  istiod_process_mem?: Metric[];
  istiod_proxy_time?: Metric[];
};

export type ZtunnelMetricsMap = {
  ztunnel_bytes_transmitted?: Metric[];
  ztunnel_connections?: Metric[];
  ztunnel_cpu_usage?: Metric[];
  ztunnel_memory_usage?: Metric[];
  ztunnel_versions?: Metric[];
  ztunnel_workload_manager?: Metric[];
};

export type ResourceUsageMetricsMap = {
  cpu_usage?: Metric[];
  memory_usage?: Metric[];
};

export type MetricsPerNamespace = { [key: string]: IstioMetricsMap };

export type IstioMetricsMap = {
  container_cpu_usage_seconds_total?: Metric[];
  container_memory_working_set_bytes?: Metric[];
  grpc_received?: Metric[];
  grpc_sent?: Metric[];
  pilot_proxy_convergence_time?: Metric[];
  process_cpu_seconds_total?: Metric[];
  process_resident_memory_bytes?: Metric[];
  request_count?: Metric[];
  request_duration_millis?: Metric[];
  request_error_count?: Metric[];
  request_size?: Metric[];
  request_throughput?: Metric[];
  response_size?: Metric[];
  response_throughput?: Metric[];
  tcp_received?: Metric[];
  tcp_sent?: Metric[];
};

export enum MetricsObjectTypes {
  SERVICE,
  WORKLOAD,
  APP,
  ZTUNNEL
}

export interface MetricsStatsResult {
  stats: MetricsStatsMap;
  // Note: warnings here is for non-blocking errors, it's set when some stats are available, but not all, for instance due to inaccessible namespaces
  // For more serious errors (e.g. prometheus inaccessible) the query would return an HTTP error
  warnings?: string[];
}

// Key is built from query params, see StatsComparison.genKey. The same key needs to be generated server-side for matching.
export type MetricsStatsMap = { [key: string]: MetricsStats };

export interface MetricsStats {
  isCompact: boolean;
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
