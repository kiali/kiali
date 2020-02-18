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
  additionalDetails: AdditionalItem[];
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
  runtimes: [],
  additionalDetails: []
};

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
  icon?: string;
  appLabel: boolean;
  versionLabel: boolean;
}

export interface WorkloadListItem extends WorkloadOverview {
  namespace: string;
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

export interface AdditionalItem {
  title: string;
  value: string;
  icon?: string;
}
