import { Metric, PromLabel, LabelDisplayName } from './Metrics';

export interface DashboardModel {
  aggregations: AggregationModel[];
  charts: ChartModel[];
  externalLinks: ExternalLink[];
  rows: number;
  title: string;
}

export type SpanValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ChartType = 'area' | 'line' | 'bar' | 'scatter';
export type XAxisType = 'time' | 'series';

export const ISTIO_ZTUNNEL_DASHBOARD = 'Istio Ztunnel Dashboard';

export interface ChartModel {
  chartType?: ChartType;
  error?: string;
  max?: number;
  metrics: Metric[];
  min?: number;
  name: string;
  rowSpans?: SpanValue;
  spans: SpanValue;
  startCollapsed: boolean;
  unit: string;
  xAxis?: XAxisType;
}

export interface AggregationModel {
  displayName: LabelDisplayName;
  label: PromLabel;
  singleSelection: boolean;
}

export interface ExternalLink {
  name: string;
  url: string;
  variables: ExternalLinkVariables;
}

export interface ExternalLinkVariables {
  app?: string;
  namespace?: string;
  service?: string;
  version?: string;
  workload?: string;
  ztunnel?: string;
}
