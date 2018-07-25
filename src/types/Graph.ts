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

export enum GraphType {
  APP = 'app',
  WORKLOAD = 'workload'
}

export interface GraphParamsType {
  namespace: Namespace;
  graphDuration: Duration;
  graphLayout: Layout;
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  versioned: boolean;
}

// This data is stored in the _global scratch area in the cy graph
// for use by code that needs access to it.
// We can add more props to this scratch data as the need arises.
export const CytoscapeGlobalScratchNamespace = '_global';
export type CytoscapeGlobalScratchData = {
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  showNodeLabels: boolean;
  versioned: boolean;
};

export interface CytoscapeBaseEvent {
  summaryType: string; // what the summary panel should show. One of: graph, node, edge, or group
  summaryTarget: any; // the cytoscape element that was the target of the event
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}
