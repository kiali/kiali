import { EdgeLabelMode } from './GraphFilter';
import Namespace from './Namespace';
import { TimeInMilliseconds } from './Common';

export interface CyData {
  updateTimestamp: TimeInMilliseconds;
  cyRef: any;
}

export const SUMMARY_PANEL_CHART_WIDTH = 250;
export type LegendPosition = 'bottom' | 'right' | 'inset';
export type SummaryType = 'graph' | 'node' | 'edge' | 'group';
export interface SummaryData {
  summaryType: SummaryType;
  summaryTarget: any;
}

export enum Protocol {
  GRPC = 'grpc',
  HTTP = 'http',
  TCP = 'tcp'
}

export interface SummaryPanelPropType {
  data: SummaryData;
  namespaces: Namespace[];
  graphType: GraphType;
  injectServiceNodes: boolean;
  queryTime: number;
  duration: number;
  step: number;
  rateInterval: string;
}

export enum GraphType {
  APP = 'app',
  SERVICE = 'service',
  VERSIONED_APP = 'versionedApp',
  WORKLOAD = 'workload'
}

export enum GroupByType {
  APP = 'app',
  NONE = 'none',
  VERSION = 'version'
}

export enum NodeType {
  APP = 'app',
  SERVICE = 'service',
  UNKNOWN = 'unknown',
  WORKLOAD = 'workload'
}

export interface NodeParamsType {
  app: string;
  namespace: Namespace;
  nodeType: NodeType;
  service: string;
  version: string;
  workload: string;
}

// This data is stored in the _global scratch area in the cy graph
// for use by code that needs access to it.
// We can add more props to this scratch data as the need arises.
export const CytoscapeGlobalScratchNamespace = '_global';
export type CytoscapeGlobalScratchData = {
  activeNamespaces: Namespace[];
  edgeLabelMode: EdgeLabelMode;
  graphType: GraphType;
  mtlsEnabled: boolean;
  showCircuitBreakers: boolean;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showNodeLabels: boolean;
  showVirtualServices: boolean;
};

export interface CytoscapeBaseEvent {
  summaryType: SummaryType; // what the summary panel should show
  summaryTarget: any; // the cytoscape element that was the target of the event
}

export interface CytoscapeClickEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseInEvent extends CytoscapeBaseEvent {}
export interface CytoscapeMouseOutEvent extends CytoscapeBaseEvent {}

// Graph Structures

// Responses is a map of maps, all strings. e.g.:
// { code0: {
//     flags0: %traffic,
//     flags1: %traffic
//   }}
export type Responses = object;

export type ProtocolTrafficNoData = {
  protocol: '';
};

export type ProtocolTrafficHttp = {
  protocol: 'http';
  rates: {
    http: string;
    httpPercentErr?: string;
  };
  responses: Responses;
};

export type ProtocolTrafficGrpc = {
  protocol: 'grpc';
  rates: {
    grpc: string;
    grpcPercentErr?: string;
  };
  responses: Responses;
};

export type ProtocolTrafficTcp = {
  protocol: 'tcp';
  rates: {
    tcp: string;
  };
  responses: Responses;
};

export type ProtocolTraffic = ProtocolTrafficHttp | ProtocolTrafficTcp | ProtocolTrafficGrpc | ProtocolTrafficNoData;

export interface GraphNodeData {
  id: string;
  parent?: string;
  nodeType: NodeType;
  namespace: string;
  workload?: string;
  app?: string;
  version?: string;
  service?: string;
  destServices?: any;
  traffic?: ProtocolTraffic[];
  hasCB?: boolean;
  hasMissingSC?: boolean;
  hasVS?: boolean;
  isDead?: boolean;
  isGroup?: string;
  isInaccessible?: boolean;
  isMisconfigured?: string;
  isOutside?: boolean;
  isRoot?: boolean;
  isServiceEntry?: string;
  isUnused?: boolean;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  traffic?: ProtocolTraffic;
  responseTime?: string;
  isMTLS?: string;
}

export interface GraphNodeWrapper {
  data: GraphNodeData;
}

export interface GraphEdgeWrapper {
  data: GraphEdgeData;
}

export interface GraphElements {
  nodes?: GraphNodeWrapper[];
  edges?: GraphEdgeWrapper[];
}

export interface GraphDefinition {
  duration: number;
  elements: GraphElements;
  graphType: GraphType;
  timestamp: number;
}

export interface DecoratedGraphNodeData extends GraphNodeData {
  grpcIn: string;
  grpcInErr: string;
  grpcOut: string;
  httpIn: string;
  httpIn3xx: string;
  httpIn4xx: string;
  httpIn5xx: string;
  httpOut: string;
  tcpIn: string;
  tcpOut: string;
}

export interface DecoratedGraphEdgeData extends GraphEdgeData {
  grpc: string;
  grpcErr: string;
  http: string;
  http3xx: string;
  http4xx: string;
  http5xx: string;
  httpPercentErr: string;
  httpPercentReq: string;
  responses: Responses;
  tcp: string;
}

export interface DecoratedGraphNodeWrapper {
  data: DecoratedGraphNodeData;
}

export interface DecoratedGraphEdgeWrapper {
  data: DecoratedGraphEdgeData;
}

export interface DecoratedGraphElements {
  nodes?: DecoratedGraphNodeWrapper[];
  edges?: DecoratedGraphEdgeWrapper[];
}
