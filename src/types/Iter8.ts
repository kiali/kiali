import { ResourcePermissions } from './Permissions';

export interface Iter8Info {
  enabled: boolean;
}

export interface Iter8Experiment {
  name: string;
  phase: string;
  status: string;
  baseline: string;
  baselinePercentage: number;
  candidate: string;
  candidatePercentage: number;
  namespace: string;
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
  trafficStepSide: number;
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
  createdAt: string;
  startedAt: string;
  endedAt: string;
  baseline: string;
  baselinePercentage: number;
  candidate: string;
  candidatePercentage: number;
  targetService: string;
  targetServiceNamespace: string;
  labels?: { [key: string]: string };
  resourceVersion: string;
}
export interface SuccessCriteria {
  name: string;
  criteria: Criteria;
  metric: Metric;
}
export interface Metric {
  absent_value: string;
  is_count: boolean;
  query_template: string;
  sample_size_template: string;
}
export interface Criteria {
  metric: string;
  tolerance: number;
  toleranceType: string;
  sampleSize: number;
  stopOnFailure: boolean;
}
