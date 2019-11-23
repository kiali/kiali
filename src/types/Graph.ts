import Namespace from './Namespace';
import { TimeInMilliseconds } from './Common';

export interface CyData {
  updateTimestamp: TimeInMilliseconds;
  cyRef: any;
}

export interface Layout {
  name: string;
}

export const SUMMARY_PANEL_CHART_WIDTH = 250;
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

export enum EdgeLabelMode {
  NONE = 'noEdgeLabels',
  REQUESTS_PER_SECOND = 'requestsPerSecond',
  REQUESTS_PERCENTAGE = 'requestsPercentage',
  RESPONSE_TIME_95TH_PERCENTILE = 'responseTime'
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

export const UNKNOWN = 'unknown';

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

type PercentageOfTrafficByFlag = {
  [flag: string]: string;
};

type PercentageOfTrafficByHost = {
  [host: string]: string;
};

export type ResponseDetail = {
  flags: PercentageOfTrafficByFlag;
  hosts: PercentageOfTrafficByHost;
};

export type Responses = {
  [responseCode: string]: ResponseDetail;
};

type ValidProtocols = 'http' | 'grpc' | 'tcp';

export type ProtocolNoTraffic = {
  protocol: ValidProtocols;
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

export type ProtocolWithTraffic = ProtocolTrafficHttp | ProtocolTrafficTcp | ProtocolTrafficGrpc;
export type ProtocolTraffic = ProtocolWithTraffic | ProtocolNoTraffic;

export const hasProtocolTraffic = (protocolTraffic: ProtocolTraffic): protocolTraffic is ProtocolWithTraffic => {
  return (
    (protocolTraffic as ProtocolWithTraffic).rates !== undefined &&
    (protocolTraffic as ProtocolWithTraffic).responses !== undefined
  );
};

// Node data expected from server
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

// Edge data expected from server
export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  traffic?: ProtocolTraffic;
  responseTime?: number;
  isMTLS?: number;
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

// Node data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedGraphNodeData extends GraphNodeData {
  grpcIn: number;
  grpcInErr: number;
  grpcOut: number;
  httpIn: number;
  httpIn3xx: number;
  httpIn4xx: number;
  httpIn5xx: number;
  httpOut: number;
  tcpIn: number;
  tcpOut: number;

  traffic: never;

  // computed, true if has istio namespace
  isIstio?: boolean;
}

// Edge data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedGraphEdgeData extends GraphEdgeData {
  grpc: number;
  grpcErr: number;
  grpcPercentErr: number;
  grpcPercentReq: number;
  http: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  httpPercentErr: number;
  httpPercentReq: number;
  responses: Responses;
  tcp: number;
  protocol: ValidProtocols;

  // During the decoration process, we make non-optional some number attributes (giving them a default value)
  // Default value NaN
  responseTime: number;

  // Default value -1
  isMTLS: number;

  // computed, true if traffic rate > 0
  hasTraffic?: boolean;
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
