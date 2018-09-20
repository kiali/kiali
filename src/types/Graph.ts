import { Duration, Layout, EdgeLabelMode } from './GraphFilter';
import Namespace from './Namespace';

// SummaryData will have two fields:
//   summaryTarget: The cytoscape element
//   summaryType  : one of 'graph', 'node', 'edge', 'group'
export interface SummaryData {
  summaryType: 'graph' | 'node' | 'edge' | 'group';
  summaryTarget: any;
}

export interface SummaryPanelPropType {
  data: SummaryData;
  namespace: string;
  graphType: GraphType;
  injectServiceNodes: boolean;
  queryTime: string;
  duration: number;
  step: number;
  rateInterval: string;
}

export enum GraphType {
  APP = 'app',
  VERSIONED_APP = 'versionedApp',
  WORKLOAD = 'workload'
}

export enum NodeType {
  APP = 'app',
  SERVICE = 'service',
  UNKNOWN = 'unknown',
  WORKLOAD = 'workload'
}

export interface NodeParamsType {
  nodeType: NodeType;
  workload: string;
  app: string;
  version: string;
}

export interface GraphParamsType {
  namespace: Namespace;
  node?: NodeParamsType;
  graphDuration: Duration;
  graphLayout: Layout;
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  injectServiceNodes: boolean;
}

// This data is stored in the _global scratch area in the cy graph
// for use by code that needs access to it.
// We can add more props to this scratch data as the need arises.
export const CytoscapeGlobalScratchNamespace = '_global';
export type CytoscapeGlobalScratchData = {
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  showCircuitBreakers: boolean;
  showMissingSidecars: boolean;
  showNodeLabels: boolean;
  showVirtualServices: boolean;
};

export interface CytoscapeBaseEvent {
  summaryType: string; // what the summary panel should show. One of: graph, node, edge, or group
  summaryTarget: any; // the cytoscape element that was the target of the event
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}
