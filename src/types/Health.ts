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

export interface DeploymentStatus {
  name: string;
  replicas: number;
  available: number;
}

export interface RequestHealth {
  requestCount: number;
  requestErrorCount: number;
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

export const getRequestErrorsRatio = (rh: RequestHealth): ThresholdStatus => {
  if (rh.requestCount === 0) {
    return {
      value: RATIO_NA,
      status: NA
    };
  }
  return ascendingThresholdCheck((100 * rh.requestErrorCount) / rh.requestCount, REQUESTS_THRESHOLDS);
};

export abstract class Health {
  items: HealthItem[];

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
    new AppHealth(json.envoy, json.deploymentStatuses, json.requests, rateInterval);

  private static computeItems(
    envoy: EnvoyHealth[],
    deploymentStatuses: DeploymentStatus[],
    requests: RequestHealth,
    rateInterval: number
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      let countInactive = 0;
      const children: HealthSubItem[] = deploymentStatuses.map(d => {
        const status = ratioCheck(d.available, d.replicas);
        if (status === NA) {
          countInactive++;
        }
        return {
          text: d.name + ': ' + d.available + ' / ' + d.replicas,
          status: status
        };
      });
      const deplStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
      const item: HealthItem = {
        title: 'Deployments Status',
        status: deplStatus,
        children: children
      };
      if (countInactive > 0 && countInactive === deploymentStatuses.length) {
        // No active deployment => special case for failure
        item.report = 'No active deployment!';
        item.status = FAILURE;
      } else if (deplStatus === FAILURE || deplStatus === DEGRADED) {
        item.report = 'Pod deployment ' + deplStatus.name.toLowerCase();
      } else if (countInactive === 1) {
        item.report = 'One inactive deployment';
      } else if (countInactive > 1) {
        item.report = `${countInactive} inactive deployments`;
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
      items.push(item);
    }
    return items;
  }

  constructor(
    public envoy: EnvoyHealth[],
    public deploymentStatuses: DeploymentStatus[],
    public requests: RequestHealth,
    public rateInterval: number
  ) {
    super(AppHealth.computeItems(envoy, deploymentStatuses, requests, rateInterval));
  }
}

export class WorkloadHealth extends Health {
  public static fromJson = (json: any, rateInterval: number) =>
    new WorkloadHealth(json.deploymentStatus, json.requests, rateInterval);

  private static computeItems(
    deploymentStatus: DeploymentStatus,
    requests: RequestHealth,
    rateInterval: number
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      const deplStatus = ratioCheck(deploymentStatus.available, deploymentStatus.replicas);
      const item: HealthItem = {
        title: 'Deployments Status',
        status: deplStatus,
        text: String(deploymentStatus.available + ' / ' + deploymentStatus.replicas)
      };
      if (deplStatus === FAILURE || deplStatus === DEGRADED) {
        item.report = 'Pod deployment ' + deplStatus.name.toLowerCase();
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

  constructor(public deploymentStatus: DeploymentStatus, public requests: RequestHealth, public rateInterval: number) {
    super(WorkloadHealth.computeItems(deploymentStatus, requests, rateInterval));
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
    { requestCount: 0, requestErrorCount: 0 },
    60
  );
};

export type NamespaceAppHealth = { [app: string]: AppHealth };
export type NamespaceWorkloadHealth = { [workload: string]: WorkloadHealth };
