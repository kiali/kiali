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
