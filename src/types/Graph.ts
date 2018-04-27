import { Duration, Layout, BadgeStatus } from './GraphFilter';
import Namespace from './Namespace';

// SummaryData will have two fields:
//   summaryTarget: The cytoscape element
//   summaryType  : one of 'graph', 'node', 'edge', 'group'
export interface SummaryData {
  summaryType: string;
  summaryTarget: any;
}

export interface SummaryPanelPropType {
  data: SummaryData;
  namespace: string;
  queryTime: string;
  duration: number;
  step: number;
  rateInterval: string;
}

export interface GraphParamsType {
  namespace: Namespace;
  graphDuration: Duration;
  graphLayout: Layout;
  badgeStatus: BadgeStatus;
}
