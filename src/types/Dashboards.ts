import { Metric, PromLabel, LabelDisplayName } from './Metrics';

export interface DashboardModel {
  title: string;
  charts: ChartModel[];
  aggregations: AggregationModel[];
  externalLinks: ExternalLink[];
  rows: number;
}

export type SpanValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ChartType = 'area' | 'line' | 'bar' | 'scatter';
export type XAxisType = 'time' | 'series';

export interface ChartModel {
  name: string;
  unit: string;
  spans: SpanValue;
  rowSpans?: SpanValue;
  chartType?: ChartType;
  min?: number;
  max?: number;
  metrics: Metric[];
  error?: string;
  startCollapsed: boolean;
  xAxis?: XAxisType;
}

export interface AggregationModel {
  label: PromLabel;
  displayName: LabelDisplayName;
  singleSelection: boolean;
}

export interface ExternalLink {
  url: string;
  name: string;
  variables: ExternalLinkVariables;
}

export interface ExternalLinkVariables {
  app?: string;
  namespace?: string;
  service?: string;
  version?: string;
  workload?: string;
}
