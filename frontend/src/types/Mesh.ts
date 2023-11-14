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

export enum MeshNodeType {
  BOX = 'box',
  ISTIOD = 'istiod',
  KIALI = 'kiali'
}

// Node data expected from server
export interface MeshGraphNodeData {
  // required
  cluster: string;
  id: string;
  namespace: string;
  nodeType: MeshNodeType;

  // optional
}

// Edge data expected from server
export interface MeshGraphEdgeData {
  id: string;
  source: string;
  target: string;
}

export interface MeshGraphNodeWrapper {
  data: MeshGraphNodeData;
}

export interface MeshGraphEdgeWrapper {
  data: MeshGraphEdgeData;
}

export interface MeshGraphElements {
  edges?: MeshGraphEdgeWrapper[];
  nodes?: MeshGraphNodeWrapper[];
}

export interface MeshGraphQuery {
  appenders?: AppenderString;
  boxBy?: string;
}

export interface MeshGraphDefinition {
  elements: MeshGraphElements;
  timestamp: number;
}
