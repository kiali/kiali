import { Controller, NodeModel, Node } from '@patternfly/react-topology';
// import { OutboundTrafficPolicy } from 'types/IstioObjects';
import { AppenderString } from './Common';
import { NamespaceInfo } from './NamespaceInfo';
import { BoxByType } from './Graph';
import { CertsInfo } from 'types/CertsInfo';

export interface MeshCluster {
  accessible: boolean;
  apiEndpoint: string;
  isKialiHome: boolean;
  kialiInstances: KialiInstance[];
  name: string;
  secretName: string;
}

export interface KialiInstance {
  namespace: string;
  operatorResource: string;
  serviceName: string;
  url: string;
  version: string;
}

export type MeshClusters = MeshCluster[];

// MESH GRAPH

export enum MeshInfraType {
  CLUSTER = 'cluster',
  DATAPLANE = 'dataplane',
  GATEWAY = 'gateway',
  GRAFANA = 'grafana',
  ISTIOD = 'istiod',
  KIALI = 'kiali',
  METRIC_STORE = 'metricStore',
  NAMESPACE = 'namespace',
  TRACE_STORE = 'traceStore',
  WAYPOINT = 'waypoint',
  ZTUNNEL = 'ztunnel'
}

export enum MeshNodeType {
  Box = 'box',
  Infra = 'infra'
}

export type MeshNodeHealthData = string;

export interface IstiodNodeData extends BaseNodeData {
  infraData: ControlPlane;
  infraType: MeshInfraType.ISTIOD;
}

export interface NamespaceNodeData extends BaseNodeData {
  infraType: MeshInfraType.NAMESPACE;
}

export interface ClusterNodeData extends BaseNodeData {
  infraData: MeshCluster;
  infraType: MeshInfraType.CLUSTER;
}

export interface DataPlaneNodeData extends BaseNodeData {
  infraData: NamespaceInfo[];
  infraType: MeshInfraType.DATAPLANE;
}

export interface GatewayNodeData extends BaseNodeData {
  // Gateway node data is the raw gateway config. We don't actually care about what
  // each field is since we just display the whole config in the side panel as is.
  infraType: MeshInfraType.GATEWAY;
}

export interface GrafanaNodeData extends BaseNodeData {
  // Grafana node data is the raw grafana config. We don't actually care about what
  // each field is since we just display the whole config in the side panel as is.
  infraData: any;
  infraType: MeshInfraType.GRAFANA;
}

export interface KialiNodeData extends BaseNodeData {
  // Kiali node data is the raw kiali config. We don't actually care about what
  // each field is since we just display the whole config in the side panel as is.
  infraData: any;
  infraType: MeshInfraType.KIALI;
}

export interface MetricStoreNodeData extends BaseNodeData {
  // MetricStore node data is the raw metric store config. We don't actually care about what
  // each field is since we just display the whole config in the side panel as is.
  infraData: any;
  infraType: MeshInfraType.METRIC_STORE;
}

export interface TraceStoreNodeData extends BaseNodeData {
  // TraceStore node data is the raw trace store config. We don't actually care about what
  // each field is since we just display the whole config in the side panel as is.
  infraType: MeshInfraType.TRACE_STORE;
}

export interface WaypointNodeData extends BaseNodeData {
  // Waypoint node data is the list of namespaces that interact with the waypoint.
  infraType: MeshInfraType.WAYPOINT;
}

export interface ZtunnelNodeData extends BaseNodeData {
  // ZTunnel node data is the ztunnel config dump, or if that is unavailable, the configured labels and annotations
  infraType: MeshInfraType.ZTUNNEL;
}

// Node data expected from server. Depending on the infraType,
// infraData and some other fields may change between the types.
// Fields that are common to all are defined in BaseNodeData.
export type MeshNodeData =
  | IstiodNodeData
  | NamespaceNodeData
  | ClusterNodeData
  | DataPlaneNodeData
  | GatewayNodeData
  | GrafanaNodeData
  | KialiNodeData
  | MetricStoreNodeData
  | TraceStoreNodeData
  | WaypointNodeData
  | ZtunnelNodeData;

// BaseNodeData has common fields for all MeshNodeData types.
interface BaseNodeData {
  cluster: string;
  healthData?: MeshNodeHealthData;
  id: string;
  infraData?: MeshCluster | NamespaceInfo[] | ControlPlane | any; // add other type options as the case arises
  infraName: string;
  infraType: MeshInfraType;
  isAmbient?: boolean;
  isBox?: BoxByType;
  isExternal?: boolean;
  isInaccessible?: boolean;
  isMTLS?: boolean;
  labels?: { [key: string]: string };
  namespace: string;
  nodeType: MeshNodeType;
  parent?: string;
  version?: string;
}

// Edge data expected from server
export interface MeshEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface MeshNodeWrapper {
  data: MeshNodeData;
}

export interface MeshEdgeWrapper {
  data: MeshEdgeData;
}

export interface MeshElements {
  edges?: MeshEdgeWrapper[];
  nodes?: MeshNodeWrapper[];
}

// TODO: unnecessary?
export interface MeshQuery {
  appenders?: AppenderString;
  includeGateways?: boolean;
  includeWaypoints?: boolean;
}

export interface MeshDefinition {
  elements: MeshElements;
  name: string;
  timestamp: number;
}

export interface Tag {
  name: string;
}

export interface ConfigSource {
  cluster?: string;
  configMap: any;
  name?: string;
  namespace?: string;
}

export interface ControlPlaneConfig {
  certificates?: CertsInfo[];
  effectiveConfig?: ConfigSource;
  sharedConfig?: ConfigSource;
  standardConfig?: ConfigSource;
}

export interface ControlPlane {
  cluster: MeshCluster;
  config: ControlPlaneConfig;
  istiodName: string;
  managedClusters?: { name: string }[];
  managedNamespaces?: NamespaceInfo[];
  revision: string;
  tag?: Tag;
  thresholds: any;
  version?: {
    version: string;
  };
}

// Node data after decorating at fetch-time (what is mainly used by ui code)
export type DecoratedMeshNodeData = MeshNodeData & {
  healthStatus: string; // status name
};

// Edge data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedMeshEdgeData extends MeshEdgeData {
  // assigned when graph is updated, the edge health depends on the node health, traffic, and config
  healthStatus?: string; // status name

  // Default value -1
  isMTLS: number;
}

export interface DecoratedMeshNodeWrapper {
  data: DecoratedMeshNodeData;
}

export interface DecoratedMeshEdgeWrapper {
  data: DecoratedMeshEdgeData;
}

export interface DecoratedMeshElements {
  edges?: DecoratedMeshEdgeWrapper[];
  nodes?: DecoratedMeshNodeWrapper[];
}

export enum MeshType {
  Box = 'box',
  Edge = 'edge',
  Mesh = 'mesh',
  Node = 'node'
}

export type BoxNodeData = ClusterNodeData | NamespaceNodeData;

export interface NodeTarget<T extends MeshNodeData> {
  elem: Node<NodeModel, T>;
  type: MeshType.Node;
}

export interface MeshControllerTarget {
  elem: Controller | undefined;
  type: MeshType.Mesh;
}

export interface EdgeTarget {
  elem: any;
  type: MeshType.Edge;
}

export interface BoxTarget<T extends BoxNodeData> {
  elem: Node<NodeModel, T>;
  type: MeshType.Box;
}

export type MeshTarget<N extends MeshNodeData = MeshNodeData, B extends BoxNodeData = BoxNodeData> =
  | NodeTarget<N>
  | MeshControllerTarget
  | EdgeTarget
  | BoxTarget<B>;

export const MeshAttr = {
  // shared attrs
  id: 'id',

  // edge attrs
  healthStatus: 'healthStatus',
  isMTLS: 'isMTLS',

  // node attrs
  cluster: 'cluster',
  health: 'health',
  infraData: 'infraData',
  infraName: 'infraName',
  infraType: 'infraType',
  isInaccessible: 'isInaccessible',
  isOutOfMesh: 'isOutOfMesh',
  namespace: 'namespace',
  nodeType: 'nodeType',
  version: 'version'
};

// determine if the infra is deployed externally, typically
// tested against the clusterName.
export function isExternal(name: string): boolean {
  return name === '_external_';
}
