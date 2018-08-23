import Namespace from './Namespace';
import { WorkloadHealth } from './Health';

export interface WorkloadId {
  namespace: string;
  workload: string;
}

interface Autoscaler {
  name: string;
  labels: { [key: string]: string[] };
  createdAt: Date;
  minReplicas: Number;
  maxReplicas: Number;
  targetCPUUtilizationPercentage: Number;
  currentReplicas: Number;
  desiredReplicas: Number;
}

export interface Deployment {
  name: string;
  type: string;
  templateAnnotations: { [key: string]: string[] };
  labels: { [key: string]: string[] };
  createdAt: Date;
  resourceVersion: string;
  replicas: Number;
  availableReplicas: Number;
  unavailableReplicas: Number;
  autoscaler: Autoscaler;
}

export const worloadLink = (ns: string, name: string) => {
  return `/namespaces/${ns}/workloads/${name}`;
};

export const WorkloadIcons = {
  Deployment: 'process-automation'
};

export const WorkloadType = {
  Deployment: 'Deployment'
};

export interface WorkloadOverview {
  name: string;
  type: string;
  istioSidecar: boolean;
  appLabel: boolean;
  versionLabel: boolean;
}

export interface WorkloadListItem {
  namespace: string;
  workload: WorkloadOverview;
  healthPromise: Promise<WorkloadHealth>;
}

export interface WorkloadNamespaceResponse {
  namespace: Namespace;
  workloads: WorkloadOverview[];
}
