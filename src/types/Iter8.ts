import { ResourcePermissions } from './Permissions';

export interface Iter8Info {
  enabled: boolean;
  supportedVersion: boolean;
  controllerImageVersion: string;
  analyticsImageVersion: string;
}

export interface Iter8CandidateStatus {
  name: string;
  version: string;
  weight: number;
  winProbability: number;
  requestCount: number;
  criterionAssessment?: CriterionAssessment[];
}

export interface LowerUpper {
  lower: number;
  upper: number;
}

export interface RatioStatitics {
  improvement_over_baseline: LowerUpper;
  probability_of_beating_baseline: number;
  probability_of_being_best_version: number;
  credible_interval: LowerUpper;
}

export interface Statistics {
  value: number;
  ratio_statistics: RatioStatitics;
}

export interface ThresholdAssessment {
  threshold_breached: boolean;
  probability_of_satisfying_threshold: number;
}

export interface CriterionAssessment {
  id: string;
  metric_id: string;
  statistics: Statistics;
  threshold_assessment: ThresholdAssessment;
}

export interface MetricProgressInfo {
  name: string;
  threshold: number;
  thresholdType: string;
  preferred_direction: string;
  unit: string;
  isReward: boolean;
}

export interface Iter8Experiment {
  name: string;
  phase: string;
  targetService: string;
  targetServiceNamespace: string;
  status: string;
  baseline: Iter8CandidateStatus;
  candidates: Iter8CandidateStatus[];
  namespace: string;
  initTime: string;
  startTime: string;
  endTime: string;
  winner: Winner;
  kind: string;
  experimentKind: string;
}

export interface Winner {
  name: string;
  winning_version_found: boolean;
  current_best_version: string;
  probability_of_winning_for_best_version: number;
}

export interface ExpId {
  namespace: string;
  name: string;
}

export interface TrafficControl {
  strategy: string;
  maxIncrement: number;
  onTermination: string;
  match: {
    http: HttpMatch[];
  };
}

export interface HttpMatch {
  headers: HeaderMatch[];
  uri: URIMatch;
}

export interface Duration {
  interval: string;
  intervalInSecond: number;
  maxIterations: number;
}

export interface Iter8ExpDetailsInfo {
  experimentItem: Iter8Experiment;
  criterias: CriteriaInfoDetail[];
  trafficControl: TrafficControl;
  duration: Duration;
  networking: {
    id: string;
    hosts: Host[];
  };
  permissions: ResourcePermissions;
  experimentType: string;
}

export const emptyExperimentItem: Iter8Experiment = {
  name: '',
  phase: '',
  targetService: '',
  targetServiceNamespace: '',
  status: '',
  baseline: {
    name: '',
    version: '',
    weight: 0,
    winProbability: 0,
    requestCount: 0
  },
  candidates: [],
  namespace: '',
  initTime: '',
  startTime: '',
  endTime: '',
  winner: {
    name: '',
    winning_version_found: false,
    current_best_version: '',
    probability_of_winning_for_best_version: 0
  },
  experimentKind: 'Canary',
  kind: 'Deployment'
};

export const emptyExperimentDetailsInfo: Iter8ExpDetailsInfo = {
  experimentItem: emptyExperimentItem,
  criterias: [],
  trafficControl: {
    strategy: 'check_and_increment',
    maxIncrement: 2,
    onTermination: 'to_winner',
    match: {
      http: []
    }
  },
  duration: {
    interval: '30s',

    intervalInSecond: 30,
    maxIterations: 100
  },
  networking: {
    id: '',
    hosts: []
  },
  permissions: {
    create: true,
    update: true,
    delete: true
  },
  experimentType: 'C'
};

export type NameValuePair = {
  name: string;
  value: any;
};

export interface CounterMetric {
  name: string;
  query_template: string;
  preferred_direction: string;
  unit: string;
}

export interface Iter8Metric {
  name: string;
  numerator: CounterMetric;
  denominator: CounterMetric;
  zero_to_one: boolean;
  preferred_direction: string;
}

export interface CriteriaInfoDetail {
  name: string;
  criteria: Iter8Criteria;
  metric: Iter8Metric;
}

export interface Iter8Criteria {
  metric: string;
  tolerance: number;
  toleranceType: string;
  isReward: boolean;
  stopOnFailure: boolean;
}

export interface Criteria {
  metric: string;
  tolerance: number;
  toleranceType: string;
  stopOnFailure: boolean;
  isReward: boolean;
}

export const initCriteria = (): Iter8Criteria => ({
  metric: '',
  tolerance: 200,
  toleranceType: 'absolute',
  stopOnFailure: false,
  isReward: false
});

export interface Host {
  name: string;
  gateway: string;
}

export interface HeaderMatch {
  key: string;
  match: string;
  stringMatch: string;
}

export interface URIMatch {
  match: string;
  stringMatch: string;
}

export interface ExperimentAction {
  action: string;
  trafficSplit: [string, string][];
}

export interface ExperimentSpec {
  name: string;
  namespace: string;
  service: string;
  apiversion: string;
  baseline: string;
  candidates: string[];
  // canaryVersion: string;
  trafficControl: TrafficControl;
  criterias: Iter8Criteria[];
  duration: Duration;
  hosts: Host[];
  routerID: string;
  experimentKind: string;
}

export const EmptyExperimentSpec = {
  name: '',
  namespace: 'default',
  apiversion: 'v1',
  service: '',
  baseline: '',
  candidate: [],
  trafficControl: {
    algorithm: 'progressive',
    maxIncrement: 10
  },
  duration: {
    interval: '30s',
    intervalInSecond: 30,
    maxIterations: 10
  },
  criterias: [],
  hosts: [],
  experimentKind: 'Deployment'
};
