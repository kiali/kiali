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
