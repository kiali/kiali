import { LabelDisplayName, SingleLabelValues } from 'k-charted-react';

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

// Map of all labels, each with its set of values
export type AllLabelsValues = Map<LabelDisplayName, SingleLabelValues>;
