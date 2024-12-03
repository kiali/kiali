import { WorkloadHealth, WorkloadHealthResponse } from './Health';
import { ObjectReference, Pod, Service, Validations } from './IstioObjects';
import { InstanceType } from 'types/Common';

export type WorkloadId = {
  namespace: string;
  workload: string;
};

export interface Workload {
  additionalDetails: AdditionalItem[];
  annotations: { [key: string]: string };
  appLabel: boolean;
  availableReplicas: Number;
  cluster?: string;
  createdAt: string;
  health?: WorkloadHealthResponse;
  instanceType: InstanceType.Workload;
  isAmbient: boolean;
  isGateway: boolean;
  istioInjectionAnnotation?: boolean;
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
  pods: Pod[];
  replicas: Number;
  resourceVersion: string;
  runtimes: Runtime[];
  services: Service[];
  type: string;
  validations?: Validations;
  versionLabel: boolean;
  waypointWorkloads: Workload[];
}

export const emptyWorkload: Workload = {
  additionalDetails: [],
  annotations: {},
  appLabel: false,
  availableReplicas: 0,
  createdAt: '',
  isAmbient: false,
  isGateway: false,
  istioSidecar: true, // true until proven otherwise
  labels: {},
  name: '',
  namespace: '',
  instanceType: InstanceType.Workload,
  pods: [],
  replicas: 0,
  resourceVersion: '',
  runtimes: [],
  services: [],
  type: '',
  versionLabel: false,
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

export interface WorkloadListItem {
  additionalDetailSample?: AdditionalItem;
  appLabel: boolean;
  cluster?: string;
  health: WorkloadHealth;
  instanceType: InstanceType.Workload;
  isAmbient: boolean;
  isGateway: boolean;
  istioReferences: ObjectReference[];
  istioSidecar: boolean;
  labels: { [key: string]: string };
  name: string;
  namespace: string;
  notCoveredAuthPolicy: boolean;
  type: string;
  versionLabel: boolean;
}

export interface WorkloadQuery {
  health: 'true' | 'false';
  rateInterval: string;
  validate: 'true' | 'false';
}

export interface WorkloadUpdateQuery {
  patchType?: string;
  type: string;
}

export interface WorkloadListQuery {
  health: 'true' | 'false';
  istioResources: 'true' | 'false';
  rateInterval: string;
}

export interface ClusterWorkloadsResponse {
  cluster?: string;
  validations: Validations;
  workloads: WorkloadListItem[];
}

export interface Runtime {
  dashboardRefs: DashboardRef[];
  name: string;
}

export interface DashboardRef {
  template: string;
  title: string;
}

export interface AdditionalItem {
  icon?: string;
  title: string;
  value: string;
}
