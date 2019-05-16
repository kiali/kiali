import Namespace from './Namespace';
import { WorkloadHealth } from './Health';
import { Pod, Service } from './IstioObjects';

export interface WorkloadId {
  namespace: string;
  workload: string;
}

export interface Workload {
  name: string;
  type: string;
  createdAt: string;
  resourceVersion: string;
  istioSidecar: boolean;
  labels: { [key: string]: string };
  appLabel: boolean;
  versionLabel: boolean;
  replicas: Number;
  availableReplicas: Number;
  pods: Pod[];
  services: Service[];
  runtimes: Runtime[];
}

export const emptyWorkload: Workload = {
  name: '',
  type: '',
  createdAt: '',
  resourceVersion: '',
  istioSidecar: true, // true until proven otherwise
  labels: {},
  appLabel: false,
  versionLabel: false,
  replicas: 0,
  availableReplicas: 0,
  pods: [],
  services: [],
  runtimes: []
};

export const worloadLink = (ns: string, name: string) => {
  return `/namespaces/${ns}/workloads/${name}`;
};

export const WorkloadIcon = 'bundle';

export const WorkloadType = {
  CronJob: 'CronJob',
  DaemonSet: 'DaemonSet',
  Deployment: 'Deployment',
  DeploymentConfig: 'DeploymentConfig',
  Job: 'Job',
  Pod: 'Pod',
  ReplicaSet: 'ReplicaSet',
  ReplicationController: 'ReplicationController',
  StatefulSet: 'StatefulSet'
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

export interface Runtime {
  name: string;
  dashboardRefs: DashboardRef[];
}

export interface DashboardRef {
  template: string;
  title: string;
}
