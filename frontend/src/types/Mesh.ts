import { Controller, GraphElement } from '@patternfly/react-topology';
import { AppenderString } from './Common';

export interface MeshCluster {
  accessible: boolean;
  apiEndpoint: string;
  isKialiHome: boolean;
  kialiInstances: KialiInstance[];
  name: string;
  network: string;
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
  ISTIOD = 'istiod',
  KIALI = 'kiali',
  METRIC_STORE = 'metricStore',
  NAMESPACE = 'namespace',
  TRACE_STORE = 'traceStore'
}

export enum MeshNodeType {
  BOX = 'box',
  INFRA = 'infra'
}

// TODO
export type MeshNodeHealthData = string;

// Node data expected from server
export interface MeshNodeData {
  // required
  cluster: string;
  id: string;
  infraName: string;
  infraType: MeshInfraType;
  namespace: string;
  nodeType: MeshNodeType;

  // optional
  healthData?: MeshNodeHealthData;
  isAmbient?: boolean;
  isBox?: string;
  isInaccessible?: boolean;
  isMTLS?: boolean;
  isOutOfMesh?: boolean;
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
}

export interface MeshDefinition {
  elements: MeshElements;
  timestamp: number;
}

// Node data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedMeshNodeData extends MeshNodeData {
  healthStatus: string; // status name
}

// Edge data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedMeshEdgeData extends MeshEdgeData {
  // Default value -1
  isMTLS: number;

  // assigned when graph is updated, the edge health depends on the node health, traffic, and config
  healthStatus?: string; // status name
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

export type MeshType = 'mesh' | 'node' | 'edge' | 'box';

export interface MeshTarget {
  elem: Controller | GraphElement;
  type: MeshType; // the element type
}
