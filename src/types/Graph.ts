import Namespace from './Namespace';
import { DurationInSeconds, TimeInSeconds } from './Common';
import { Health } from './Health';
import { HealthAnnotationType } from './HealthAnnotation';

export interface Layout {
  name: string;
}

export const SUMMARY_PANEL_CHART_WIDTH = 250;
export type SummaryType = 'graph' | 'node' | 'edge' | 'box';
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
  duration: DurationInSeconds;
  graphType: GraphType;
  injectServiceNodes: boolean;
  namespaces: Namespace[];
  queryTime: TimeInSeconds;
  rateInterval: string;
  step: number;
  trafficRates: TrafficRate[];
}

export enum EdgeLabelMode {
  RESPONSE_TIME_GROUP = 'responseTime',
  RESPONSE_TIME_AVERAGE = 'avg',
  RESPONSE_TIME_P50 = 'rt50',
  RESPONSE_TIME_P95 = 'rt95',
  RESPONSE_TIME_P99 = 'rt99',
  THROUGHPUT_GROUP = 'throughput',
  THROUGHPUT_REQUEST = 'throughputRequest',
  THROUGHPUT_RESPONSE = 'throughputResponse',
  TRAFFIC_DISTRIBUTION = 'trafficDistribution',
  TRAFFIC_RATE = 'trafficRate'
}

export const isResponseTimeMode = (mode: EdgeLabelMode): boolean => {
  return (
    mode === EdgeLabelMode.RESPONSE_TIME_GROUP ||
    mode === EdgeLabelMode.RESPONSE_TIME_AVERAGE ||
    mode === EdgeLabelMode.RESPONSE_TIME_P50 ||
    mode === EdgeLabelMode.RESPONSE_TIME_P95 ||
    mode === EdgeLabelMode.RESPONSE_TIME_P99
  );
};

export const isThroughputMode = (mode: EdgeLabelMode): boolean => {
  return (
    mode === EdgeLabelMode.THROUGHPUT_GROUP ||
    mode === EdgeLabelMode.THROUGHPUT_REQUEST ||
    mode === EdgeLabelMode.THROUGHPUT_RESPONSE
  );
};

export const numLabels = (modes: EdgeLabelMode[]): number => {
  return modes.filter(m => m !== EdgeLabelMode.RESPONSE_TIME_GROUP && m !== EdgeLabelMode.THROUGHPUT_GROUP).length;
};

export enum TrafficRate {
  GRPC_GROUP = 'grpc',
  GRPC_RECEIVED = 'grpcReceived', // response_messages
  GRPC_REQUEST = 'grpcRequest',
  GRPC_SENT = 'grpcSent', // request_messages
  GRPC_TOTAL = 'grpcTotal', // sent_bytes + received_bytes
  HTTP_GROUP = 'http',
  HTTP_REQUEST = 'httpRequest',
  TCP_GROUP = 'tcp',
  TCP_RECEIVED = 'tcpReceived', // received_bytes
  TCP_SENT = 'tcpSent', // sent_bytes
  TCP_TOTAL = 'tcpTotal' // sent_bytes + received_bytes
}

export const DefaultTrafficRates: TrafficRate[] = [
  TrafficRate.GRPC_GROUP,
  TrafficRate.GRPC_REQUEST,
  TrafficRate.HTTP_GROUP,
  TrafficRate.HTTP_REQUEST,
  TrafficRate.TCP_GROUP,
  TrafficRate.TCP_SENT
];

export const isGrpcRate = (rate: TrafficRate): boolean => {
  return (
    rate === TrafficRate.GRPC_GROUP ||
    rate === TrafficRate.GRPC_RECEIVED ||
    rate === TrafficRate.GRPC_REQUEST ||
    rate === TrafficRate.GRPC_SENT ||
    rate === TrafficRate.GRPC_TOTAL
  );
};

export const toGrpcRate = (rate: string): TrafficRate | undefined => {
  switch (rate) {
    case 'received':
      return TrafficRate.GRPC_RECEIVED;
    case 'requests':
    case 'request':
      return TrafficRate.GRPC_REQUEST;
    case 'sent':
      return TrafficRate.GRPC_SENT;
    case 'total':
      return TrafficRate.GRPC_TOTAL;
    default:
      return undefined;
  }
};

export const isHttpRate = (rate: TrafficRate): boolean => {
  return rate === TrafficRate.HTTP_GROUP || rate === TrafficRate.HTTP_REQUEST;
};

export const toHttpRate = (rate: string): TrafficRate | undefined => {
  switch (rate) {
    case 'requests':
    case 'request':
      return TrafficRate.HTTP_REQUEST;
    default:
      return undefined;
  }
};

export const isTcpRate = (rate: TrafficRate): boolean => {
  return (
    rate === TrafficRate.TCP_GROUP ||
    rate === TrafficRate.TCP_RECEIVED ||
    rate === TrafficRate.TCP_SENT ||
    rate === TrafficRate.TCP_TOTAL
  );
};

export const toTcpRate = (rate: string): TrafficRate | undefined => {
  switch (rate) {
    case 'received':
      return TrafficRate.TCP_RECEIVED;
    case 'sent':
      return TrafficRate.TCP_SENT;
    case 'total':
      return TrafficRate.TCP_TOTAL;
    default:
      return undefined;
  }
};

export enum GraphType {
  APP = 'app',
  SERVICE = 'service',
  VERSIONED_APP = 'versionedApp',
  WORKLOAD = 'workload'
}

export enum BoxByType {
  APP = 'app',
  CLUSTER = 'cluster',
  NAMESPACE = 'namespace'
}

export enum NodeType {
  AGGREGATE = 'aggregate',
  APP = 'app',
  BOX = 'box',
  SERVICE = 'service',
  UNKNOWN = 'unknown',
  WORKLOAD = 'workload'
}

export const CLUSTER_DEFAULT = 'Kubernetes'; // Istio default cluster, typically indicates a single-cluster env
export const UNKNOWN = 'unknown';

export interface NodeParamsType {
  aggregate?: string;
  aggregateValue?: string;
  app: string;
  namespace: Namespace;
  nodeType: NodeType;
  service: string;
  version?: string;
  workload: string;
}

// This data is stored in the _global scratch area in the cy graph
// for use by code that needs access to it.
// We can add more props to this scratch data as the need arises.
export const CytoscapeGlobalScratchNamespace = '_global';
export type CytoscapeGlobalScratchData = {
  activeNamespaces: Namespace[];
  homeCluster: string;
  edgeLabels: EdgeLabelMode[];
  graphType: GraphType;
  showMissingSidecars: boolean;
  showSecurity: boolean;
  showVirtualServices: boolean;
  trafficRates: TrafficRate[];
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

export interface DestService {
  cluster: string;
  namespace: string;
  name: string;
}

export interface SEInfo {
  hosts: string[];
  location: string;
  namespace: string; // namespace represents where the ServiceEntry object is defined and not necessarily the namespace of the node.
}

// Node data expected from server
export interface GraphNodeData {
  id: string;
  parent?: string;
  nodeType: NodeType;
  cluster: string;
  namespace: string;
  workload?: string;
  app?: string;
  version?: string;
  service?: string;
  aggregate?: string;
  aggregateValue?: string;
  destServices?: DestService[];
  traffic?: ProtocolTraffic[];
  hasCB?: boolean;
  hasFaultInjection?: boolean;
  hasHealthConfig?: HealthAnnotationType;
  hasMissingSC?: boolean;
  hasRequestRouting?: boolean;
  hasRequestTimeout?: boolean;
  hasTCPTrafficShifting?: boolean;
  hasTrafficShifting?: boolean;
  hasVS?: {
    hostnames?: string[];
  };
  isBox?: string;
  isDead?: boolean;
  isIdle?: boolean;
  isInaccessible?: boolean;
  isGateway?: {
    ingressInfo?: {
      hostnames?: string[];
    };
  };
  isMisconfigured?: string;
  isOutside?: boolean;
  isRoot?: boolean;
  isServiceEntry?: SEInfo;
}

// Edge data expected from server
export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  destPrincipal?: string;
  responseTime?: number;
  sourcePrincipal?: string;
  traffic?: ProtocolTraffic;
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
  grpcInNoResponse: number;
  grpcOut: number;
  health: Health;
  healthStatus: string; // status name
  httpIn: number;
  httpIn3xx: number;
  httpIn4xx: number;
  httpIn5xx: number;
  httpInNoResponse: number;
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
  grpcNoResponse: number;
  grpcPercentErr: number;
  grpcPercentReq: number;
  http: number;
  http3xx: number;
  http4xx: number;
  http5xx: number;
  httpNoResponse: number;
  httpPercentErr: number;
  httpPercentReq: number;
  protocol: ValidProtocols;
  responses: Responses;
  tcp: number;

  // During the decoration process, we make non-optional some number attributes (giving them a default value)
  // computed, true if traffic rate > 0
  hasTraffic?: boolean;
  // Default value -1
  isMTLS: number;
  // Default value NaN
  responseTime: number;
  // Default value NaN
  throughput: number;
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
