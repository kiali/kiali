import Namespace from './Namespace';
import { WorkloadHealth, WorkloadHealthResponse } from './Health';
import { ObjectReference, Pod, Service, Validations } from './IstioObjects';

export interface WorkloadId {
  namespace: string;
  workload: string;
}

export interface Workload {
  name: string;
  cluster?: string;
  type: string;
  createdAt: string;
  resourceVersion: string;
  istioInjectionAnnotation?: boolean;
  istioSidecar: boolean;
  istioAmbient: boolean;
  labels: { [key: string]: string };
  appLabel: boolean;
  versionLabel: boolean;
  replicas: Number;
  availableReplicas: Number;
  pods: Pod[];
  annotations: { [key: string]: string };
  health?: WorkloadHealthResponse;
  services: Service[];
  runtimes: Runtime[];
  additionalDetails: AdditionalItem[];
  validations?: Validations;
  waypointWorkloads: Workload[];
}

export const emptyWorkload: Workload = {
  name: '',
  type: '',
  createdAt: '',
  resourceVersion: '',
  istioSidecar: true, // true until proven otherwise
  istioAmbient: false,
  labels: {},
  appLabel: false,
  versionLabel: false,
  replicas: 0,
  availableReplicas: 0,
  pods: [],
  annotations: {},
  services: [],
  runtimes: [],
  additionalDetails: [],
  waypointWorkloads: []
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
  cluster: string;
  type: string;
  istioSidecar: boolean;
  istioAmbient: boolean;
  additionalDetailSample?: AdditionalItem;
  appLabel: boolean;
  versionLabel: boolean;
  labels: { [key: string]: string };
  istioReferences: ObjectReference[];
  notCoveredAuthPolicy: boolean;
  health: WorkloadHealth;
}

export interface WorkloadListItem extends WorkloadOverview {
  namespace: string;
}

export interface WorkloadNamespaceResponse {
  namespace: Namespace;
  workloads: WorkloadOverview[];
  validations: Validations;
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
