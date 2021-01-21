export interface MeshCluster {
  apiEndpoint: string;
  isKialiHome: boolean;
  name: string;
  network: string;
  secretName: string;
}

export type MeshClusters = MeshCluster[];
