export interface MeshCluster {
  apiEndpoint: string;
  isKialiHome: boolean;
  kialiInstances: KialiInstance[];
  name: string;
  network: string;
  secretName: string;
}

export interface KialiInstance {
  serviceName: string;
  namespace: string;
  operatorResource: string;
  url: string;
  version: string;
}

export type MeshClusters = MeshCluster[];

// Internal Ambient Mesh indicators
export const AmbientAnnotation = 'ambient.istio.io/redirection';
export const AmbientAnnotationEnabled = 'enabled';
export const WaypointLabel = 'gateway.istio.io/managed';
export const WaypointLabelValue = 'istio.io-mesh-controller';
