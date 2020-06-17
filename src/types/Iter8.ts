import { ResourcePermissions } from './Permissions';

export interface Iter8Info {
  enabled: boolean;
}

export interface Iter8Experiment {
  name: string;
  phase: string;
  targetService: string;
  status: string;
  baseline: string;
  baselinePercentage: number;
  candidate: string;
  candidatePercentage: number;
  namespace: string;
  createdAt: number;
  startedAt: number;
  endedAt: number;
}

export interface ExpId {
  namespace: string;
  name: string;
}

export interface TrafficControl {
  algorithm: string;
  interval: string;
  maxIterations: number;
  maxTrafficPercentage: number;
  trafficStepSize: number;
}

export interface Iter8ExpDetailsInfo {
  experimentItem: ExperimentItem;
  criterias: SuccessCriteria[];
  trafficControl: TrafficControl;
  permissions: ResourcePermissions;
}

export interface ExperimentItem {
  name: string;
  namespace: string;
  phase: string;
  status: string;
  createdAt: number;
  startedAt: number;
  endedAt: number;
  baseline: string;
  baselinePercentage: number;
  candidate: string;
  candidatePercentage: number;
  targetService: string;
  targetServiceNamespace: string;
  assessmentConclusion: string[];
  labels?: { [key: string]: string };
  resourceVersion: string;
}
export interface SuccessCriteria {
  name: string;
  criteria: Criteria;
  metric: Metric;
  status: SuccessCriteriaStatus;
}
export interface Metric {
  absent_value: string;
  is_count: boolean;
  query_template: string;
  sample_size_template: string;
}

export interface SuccessCriteriaStatus {
  conclusions: string[];
  success_criterion_met: boolean;
  abort_experiment: boolean;
}

export type NameValuePair = {
  name: string;
  value: any;
};

export interface Criteria {
  metric: string;
  tolerance: number;
  toleranceType: string;
  sampleSize: number;
  stopOnFailure: boolean;
}

export interface ExperimentAction {
  action: string;
}

export interface ExperimentSpec {
  name: string;
  namespace: string;
  service: string;
  apiversion: string;
  baseline: string;
  candidate: string;
  // canaryVersion: string;
  trafficControl: TrafficControl;
  criterias: Criteria[];
}

export const EmptyExperimentSpec = {
  name: '',
  namespace: 'default',
  apiversion: 'v1',
  service: '',
  baseline: '',
  candidate: '',
  trafficControl: {
    algorithm: 'check_and_increment',
    interval: '30s',
    maxIterations: 100,
    maxTrafficPercentage: 50,
    trafficStepSize: 2
  },
  criterias: []
};
