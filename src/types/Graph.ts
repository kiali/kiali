import { Duration, Layout, EdgeLabelMode } from './GraphFilter';
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
  edgeLabelMode: EdgeLabelMode;
}

export interface CytoscapeBaseEvent {
  summaryType: string; // what the summary panel should show. One of: graph, node, edge, or group
  summaryTarget: any; // the cytoscape element that was the target of the event
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}
