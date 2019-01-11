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

export type LabelDisplayName = string;
export type PromLabel = string;

// Collection of values for a single label, associated to a show/hide flag
export type SingleLabelValues = { [key: string]: boolean };

// Map of all labels, each with its set of values
export type AllLabelsValues = Map<LabelDisplayName, SingleLabelValues>;

// Map of all labels (using prometheus name), each with its set of values
export type AllPromLabelsValues = Map<PromLabel, SingleLabelValues>;

export interface MonitoringDashboard {
  title: string;
  charts: Chart[];
  aggregations: Aggregation[];
}

export interface Chart {
  name: string;
  unit: string;
  spans: number;
  counterRate?: MetricGroup;
  histogram?: Histogram;
}

export interface Aggregation {
  label: PromLabel;
  displayName: LabelDisplayName;
}
