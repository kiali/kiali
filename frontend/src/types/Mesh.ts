import { Controller, ElementModel, GraphElement } from '@patternfly/react-topology';
import { AppenderString } from './Common';
import { NamespaceInfo } from './NamespaceInfo';

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
  GRAFANA = 'grafana',
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

export type MeshNodeHealthData = string;

// Node data expected from server
export interface MeshNodeData {
  cluster: string;
  healthData?: MeshNodeHealthData;
  id: string;
  infraData?: MeshCluster | NamespaceInfo[] | any; // add other type options as the case arises
  infraName: string;
  infraType: MeshInfraType;
  isAmbient?: boolean;
  isBox?: string;
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
}

export interface MeshDefinition {
  elements: MeshElements;
  name: string;
  timestamp: number;
}

// TODO: Make these lowercase.
export interface Tag {
  name: string;
}

export interface ControlPlane {
  cluster: MeshCluster;
  istiodName: string;
  managedClusters?: { name: string }[];
  managedNamespaces?: NamespaceInfo[];
  revision: string;
  tags: Tag[];
  version?: {
    version: string;
  };
}

// Node data after decorating at fetch-time (what is mainly used by ui code)
export interface DecoratedMeshNodeData extends MeshNodeData {
  healthStatus: string; // status name
}

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

export type MeshType = 'mesh' | 'node' | 'edge' | 'box';

export interface MeshTarget {
  elem: Controller | GraphElement<ElementModel, any> | undefined;
  type: MeshType; // the element type
}

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
