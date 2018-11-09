import { PfColors } from '../components/Pf/PfColors';
import { getName } from '../utils/RateIntervals';

interface HealthItem {
  status: Status;
  title: string;
  text?: string;
  children?: HealthSubItem[];
  report?: string;
}

interface HealthSubItem {
  status: Status;
  text: string;
}

export interface EnvoyHealth {
  inbound: EnvoyRatio;
  outbound: EnvoyRatio;
  service?: string;
}

export interface EnvoyRatio {
  healthy: number;
  total: number;
}

export interface WorkloadStatus {
  name: string;
  replicas: number;
  available: number;
}

export interface RequestHealth {
  errorRatio: number;
  inboundErrorRatio: number;
  outboundErrorRatio: number;
}

export interface Status {
  name: string;
  color: string;
  priority: number;
  icon?: string;
  text?: string;
}

export const FAILURE: Status = {
  name: 'Failure',
  color: PfColors.Red100,
  priority: 3,
  icon: 'error-circle-o'
};
export const DEGRADED: Status = {
  name: 'Degraded',
  color: PfColors.Orange400,
  priority: 2,
  icon: 'warning-triangle-o'
};
export const HEALTHY: Status = {
  name: 'Healthy',
  color: PfColors.Green400,
  priority: 1,
  icon: 'ok'
};
export const NA: Status = {
  name: 'No health information',
  color: PfColors.Gray,
  priority: 0,
  text: 'N/A'
};

interface Thresholds {
  degraded: number;
  failure: number;
  unit: string;
}

export const REQUESTS_THRESHOLDS: Thresholds = {
  degraded: 0.1,
  failure: 20,
  unit: '%'
};

interface ThresholdStatus {
  value: number;
  status: Status;
  violation?: string;
}

// Use -1 rather than NaN to allow straigthforward comparison
const RATIO_NA = -1;

export const ratioCheck = (valid: number, total: number): Status => {
  if (total === 0) {
    return NA;
  } else if (valid === 0) {
    return FAILURE;
  } else if (valid === total) {
    return HEALTHY;
  }
  return DEGRADED;
};

export const mergeStatus = (s1: Status, s2: Status): Status => {
  return s1.priority > s2.priority ? s1 : s2;
};

const ascendingThresholdCheck = (value: number, thresholds: Thresholds): ThresholdStatus => {
  if (value >= thresholds.failure) {
    return {
      value: value,
      status: FAILURE,
      violation: value.toFixed(2) + thresholds.unit + '>=' + thresholds.failure + thresholds.unit
    };
  } else if (value >= thresholds.degraded) {
    return {
      value: value,
      status: DEGRADED,
      violation: value.toFixed(2) + thresholds.unit + '>=' + thresholds.degraded + thresholds.unit
    };
  }
  return { value: value, status: HEALTHY };
};

export const getRequestErrorsRatio = (rh: RequestHealth, propName?: keyof RequestHealth): ThresholdStatus => {
  if (propName === undefined) {
    propName = 'errorRatio';
  }

  if (rh[propName] < 0) {
    return {
      value: RATIO_NA,
      status: NA
    };
  }
  return ascendingThresholdCheck(100 * rh[propName], REQUESTS_THRESHOLDS);
};

export abstract class Health {
  items: HealthItem[];

  protected static getErrorsRatioDetail(rh: RequestHealth, direction: 'inbound' | 'outbound'): HealthSubItem {
    const errorRatio = getRequestErrorsRatio(rh, `${direction}ErrorRatio` as keyof RequestHealth);
    const health: HealthSubItem = {
      status: errorRatio.status,
      text: errorRatio.status === NA ? `No ${direction} requests` : `${errorRatio.value.toFixed(2)}% ${direction} error`
    };

    return health;
  }

  protected static adjustOverallHealth(health: HealthItem) {
    // Show in the overall requests health status, the one of the highest priority
    if (health.children === undefined) {
      return;
    }

    health.children.forEach(child => {
      if (child.status.priority > health.status.priority) {
        health.status = child.status;
      }
    });
  }

  constructor(items: HealthItem[]) {
    this.items = items;
  }

  getGlobalStatus(): Status {
    return this.items.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
  }

  getReport(): string[] {
    return this.items.filter(i => i.report !== undefined).map(i => i.report!);
  }
}

export class ServiceHealth extends Health {
  public static fromJson = (json: any, rateInterval: number) =>
    new ServiceHealth(json.envoy, json.requests, rateInterval);

  private static computeItems(envoy: EnvoyHealth, requests: RequestHealth, rateInterval: number): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Envoy
      const inboundStatus = ratioCheck(envoy.inbound.healthy, envoy.inbound.total);
      const outboundStatus = ratioCheck(envoy.outbound.healthy, envoy.outbound.total);
      const envoyStatus = mergeStatus(inboundStatus, outboundStatus);
      const item: HealthItem = {
        title: 'Envoy Health',
        status: envoyStatus,
        children: [
          {
            text: 'Inbound: ' + envoy.inbound.healthy + ' / ' + envoy.inbound.total,
            status: inboundStatus
          },
          {
            text: 'Outbound: ' + envoy.outbound.healthy + ' / ' + envoy.outbound.total,
            status: outboundStatus
          }
        ]
      };
      if (envoyStatus === FAILURE || envoyStatus === DEGRADED) {
        item.report = 'Envoy health ' + envoyStatus.name.toLowerCase();
      }
      items.push(item);
    }
    {
      // Request errors
      const reqErrorsRatio = getRequestErrorsRatio(requests);
      const reqErrorsText = reqErrorsRatio.status === NA ? 'No requests' : reqErrorsRatio.value.toFixed(2) + '%';
      const item: HealthItem = {
        title: 'Error Rate',
        status: reqErrorsRatio.status,
        text: reqErrorsText + ' over ' + getName(rateInterval).toLowerCase()
      };
      if (reqErrorsRatio.violation) {
        item.report = `Error rate ${reqErrorsRatio.status.name.toLowerCase()}: ${reqErrorsRatio.violation}`;
      }
      items.push(item);
    }
    return items;
  }

  constructor(public envoy: EnvoyHealth, public requests: RequestHealth, public rateInterval: number) {
    super(ServiceHealth.computeItems(envoy, requests, rateInterval));
  }
}

export class AppHealth extends Health {
  public static fromJson = (json: any, rateInterval: number) =>
    new AppHealth(json.envoy, json.workloadStatuses, json.requests, rateInterval);

  private static computeItems(
    envoy: EnvoyHealth[],
    workloadStatuses: WorkloadStatus[],
    requests: RequestHealth,
    rateInterval: number
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      let countInactive = 0;
      const children: HealthSubItem[] = workloadStatuses.map(d => {
        const status = ratioCheck(d.available, d.replicas);
        if (status === NA) {
          countInactive++;
        }
        return {
          text: d.name + ': ' + d.available + ' / ' + d.replicas,
          status: status
        };
      });
      const workloadStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
      const item: HealthItem = {
        title: 'Workload Status',
        status: workloadStatus,
        children: children
      };
      if (countInactive > 0 && countInactive === workloadStatuses.length) {
        // No active deployment => special case for failure
        item.report = 'No active workload!';
        item.status = FAILURE;
      } else if (workloadStatus === FAILURE || workloadStatus === DEGRADED) {
        item.report = 'Pod workload ' + workloadStatus.name.toLowerCase();
      } else if (countInactive === 1) {
        item.report = 'One inactive workload';
      } else if (countInactive > 1) {
        item.report = `${countInactive} inactive workloads`;
      }
      items.push(item);
    }
    {
      // Envoy
      const envoyInbound: HealthSubItem[] = envoy.map(e => ({
        text: e.service + ' (in): ' + e.inbound.healthy + ' / ' + e.inbound.total,
        status: ratioCheck(e.inbound.healthy, e.inbound.total)
      }));
      const envoyOutbound: HealthSubItem[] = envoy.map(e => ({
        text: e.service + ' (out): ' + e.outbound.healthy + ' / ' + e.outbound.total,
        status: ratioCheck(e.outbound.healthy, e.outbound.total)
      }));
      const children = envoyInbound.concat(envoyOutbound);
      const envoyStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
      const item: HealthItem = {
        title: 'Envoy Health',
        status: envoyStatus,
        children: children
      };
      if (envoyStatus === FAILURE || envoyStatus === DEGRADED) {
        item.report = 'Envoy health ' + envoyStatus.name.toLowerCase();
      }
      items.push(item);
    }
    {
      // Request errors
      const reqErrorsRatio = getRequestErrorsRatio(requests);
      const reqErrorsText = reqErrorsRatio.status === NA ? 'No requests' : reqErrorsRatio.value.toFixed(2) + '%';
      const item: HealthItem = {
        title: 'Error Rate',
        status: reqErrorsRatio.status,
        text: reqErrorsText + ' over ' + getName(rateInterval).toLowerCase()
      };
      if (reqErrorsRatio.violation) {
        item.report = `Error rate ${reqErrorsRatio.status.name.toLowerCase()}: ${reqErrorsRatio.violation}`;
      }

      if (reqErrorsRatio.status !== NA) {
        // Inbound and outbound detail
        item.children = [
          this.getErrorsRatioDetail(requests, 'inbound'),
          this.getErrorsRatioDetail(requests, 'outbound')
        ];
      }

      this.adjustOverallHealth(item);
      items.push(item);
    }
    return items;
  }

  constructor(
    public envoy: EnvoyHealth[],
    public workloadStatuses: WorkloadStatus[],
    public requests: RequestHealth,
    public rateInterval: number
  ) {
    super(AppHealth.computeItems(envoy, workloadStatuses, requests, rateInterval));
  }
}

export class WorkloadHealth extends Health {
  public static fromJson = (json: any, rateInterval: number) =>
    new WorkloadHealth(json.workloadStatus, json.requests, rateInterval);

  private static computeItems(
    workloadStatus: WorkloadStatus,
    requests: RequestHealth,
    rateInterval: number
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      const workStatus = ratioCheck(workloadStatus.available, workloadStatus.replicas);
      const item: HealthItem = {
        title: 'Workloads Status',
        status: workStatus,
        text: String(workloadStatus.available + ' / ' + workloadStatus.replicas)
      };
      if (workStatus === FAILURE || workStatus === DEGRADED) {
        item.report = 'Pod workload ' + workStatus.name.toLowerCase();
      }
      items.push(item);
    }
    {
      // Request errors
      const reqErrorsRatio = getRequestErrorsRatio(requests);
      const reqErrorsText = reqErrorsRatio.status === NA ? 'No requests' : reqErrorsRatio.value.toFixed(2) + '%';
      const item: HealthItem = {
        title: 'Error Rate',
        status: reqErrorsRatio.status,
        text: reqErrorsText + ' over ' + getName(rateInterval).toLowerCase()
      };
      if (reqErrorsRatio.violation) {
        item.report = `Error rate ${reqErrorsRatio.status.name.toLowerCase()}: ${reqErrorsRatio.violation}`;
      }

      if (reqErrorsRatio.status !== NA) {
        // Inbound and outbound detail
        item.children = [
          this.getErrorsRatioDetail(requests, 'inbound'),
          this.getErrorsRatioDetail(requests, 'outbound')
        ];
      }

      this.adjustOverallHealth(item);
      items.push(item);
    }
    return items;
  }

  constructor(public workloadStatus: WorkloadStatus, public requests: RequestHealth, public rateInterval: number) {
    super(WorkloadHealth.computeItems(workloadStatus, requests, rateInterval));
  }
}

export const healthNotAvailable = (): AppHealth => {
  return new AppHealth(
    [
      {
        inbound: { healthy: 0, total: 0 },
        outbound: { healthy: 0, total: 0 },
        service: 'n/a'
      }
    ],
    [],
    { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
    60
  );
};

export type NamespaceAppHealth = { [app: string]: AppHealth };
export type NamespaceServiceHealth = { [service: string]: ServiceHealth };
export type NamespaceWorkloadHealth = { [workload: string]: WorkloadHealth };
