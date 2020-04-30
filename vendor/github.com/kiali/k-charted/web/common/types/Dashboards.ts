import { TimeSeries } from './Metrics';
import { PromLabel, LabelDisplayName } from './Labels';

export interface DashboardModel {
  title: string;
  charts: ChartModel[];
  aggregations: AggregationModel[];
  externalLinks: ExternalLink[];
}

export type SpanValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ChartType = 'area' | 'line' | 'bar' | 'scatter';

export interface ChartModel {
  name: string;
  unit: string;
  spans: SpanValue;
  chartType?: ChartType;
  min?: number;
  max?: number;
  metrics: TimeSeries[];
  error?: string;
}

export interface AggregationModel {
  label: PromLabel;
  displayName: LabelDisplayName;
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
