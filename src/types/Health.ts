import { ErrorCircleOIcon, WarningTriangleIcon, OkIcon, UnknownIcon } from '@patternfly/react-icons';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';
import { PfColors } from '../components/Pf/PfColors';
import { getName } from '../utils/RateIntervals';

interface HealthItem {
  status: Status;
  title: string;
  text?: string;
  children?: HealthSubItem[];
}

interface HealthSubItem {
  status: Status;
  text: string;
}

export interface WorkloadStatus {
  name: string;
  desiredReplicas: number;
  currentReplicas: number;
  availableReplicas: number;
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
  icon: IconType;
  class: string;
}

export const FAILURE: Status = {
  name: 'Failure',
  color: PfColors.Red100,
  priority: 3,
  icon: ErrorCircleOIcon,
  class: 'icon-failure'
};
export const DEGRADED: Status = {
  name: 'Degraded',
  color: PfColors.Orange400,
  priority: 2,
  icon: WarningTriangleIcon,
  class: 'icon-degraded'
};
export const HEALTHY: Status = {
  name: 'Healthy',
  color: PfColors.Green400,
  priority: 1,
  icon: OkIcon,
  class: 'icon-healthy'
};
export const NA: Status = {
  name: 'No health information',
  color: PfColors.Gray,
  priority: 0,
  icon: UnknownIcon,
  class: 'icon-na'
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

export const ratioCheck = (availableReplicas: number, currentReplicas: number, desiredReplicas: number): Status => {
  // No Pods returns No Health Info
  if (desiredReplicas === 0 && currentReplicas === 0) {
    return NA;
  }
  // No available Pods when there are desired and current means a Failure
  if (desiredReplicas > 0 && currentReplicas > 0 && availableReplicas === 0) {
    return FAILURE;
  }
  // Pending Pods means problems
  if (desiredReplicas === availableReplicas && availableReplicas !== currentReplicas) {
    return FAILURE;
  }
  // Health condition
  if (desiredReplicas === currentReplicas && currentReplicas === availableReplicas) {
    return HEALTHY;
  }
  // Other combination could mean a degraded situation
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

export const getRequestErrorsStatus = (ratio: number): ThresholdStatus => {
  if (ratio < 0) {
    return {
      value: RATIO_NA,
      status: NA
    };
  }
  return ascendingThresholdCheck(100 * ratio, REQUESTS_THRESHOLDS);
};

export const getRequestErrorsSubItem = (thresholdStatus: ThresholdStatus, prefix: string): HealthSubItem => {
  return {
    status: thresholdStatus.status,
    text: prefix + ': ' + (thresholdStatus.status === NA ? 'No requests' : thresholdStatus.value.toFixed(2) + '%')
  };
};

export const getRequestErrorsViolations = (reqIn: ThresholdStatus, reqOut: ThresholdStatus): string => {
  const violations: string[] = [];
  if (reqIn.violation) {
    violations.push(`Inbound errors: ${reqIn.violation}`);
  }
  if (reqOut.violation) {
    violations.push(`Outbound errors: ${reqOut.violation}`);
  }
  return violations.join(', ');
};

export abstract class Health {
  constructor(public items: HealthItem[]) {}

  getGlobalStatus(): Status {
    return this.items.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
  }
}

interface HealthContext {
  rateInterval: number;
  hasSidecar: boolean;
}

export class ServiceHealth extends Health {
  public static fromJson = (json: any, ctx: HealthContext) => new ServiceHealth(json.requests, ctx);

  private static computeItems(requests: RequestHealth, ctx: HealthContext): HealthItem[] {
    const items: HealthItem[] = [];
    if (ctx.hasSidecar) {
      // Request errors
      const reqErrorsRatio = getRequestErrorsStatus(requests.errorRatio);
      const reqErrorsText = reqErrorsRatio.status === NA ? 'No requests' : reqErrorsRatio.value.toFixed(2) + '%';
      const item: HealthItem = {
        title: 'Error Rate over ' + getName(ctx.rateInterval).toLowerCase(),
        status: reqErrorsRatio.status,
        text: reqErrorsText
      };
      items.push(item);
    } else {
      items.push({
        title: 'Error Rate',
        status: NA,
        text: 'No Istio sidecar'
      });
    }
    return items;
  }

  constructor(public requests: RequestHealth, ctx: HealthContext) {
    super(ServiceHealth.computeItems(requests, ctx));
  }
}

export class AppHealth extends Health {
  public static fromJson = (json: any, ctx: HealthContext) => new AppHealth(json.workloadStatuses, json.requests, ctx);

  private static computeItems(
    workloadStatuses: WorkloadStatus[],
    requests: RequestHealth,
    ctx: HealthContext
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      let countInactive = 0;
      const children: HealthSubItem[] = workloadStatuses.map(d => {
        const status = ratioCheck(d.availableReplicas, d.currentReplicas, d.desiredReplicas);
        if (status === NA) {
          countInactive++;
        }
        return {
          text: d.name + ': ' + d.availableReplicas + ' / ' + d.desiredReplicas,
          status: status
        };
      });
      const podsStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
      const item: HealthItem = {
        title: 'Pods Status',
        status: podsStatus,
        children: children
      };
      if (countInactive > 0 && countInactive === workloadStatuses.length) {
        // No active deployment => special case for failure
        item.status = FAILURE;
      }
      items.push(item);
    }
    // Request errors
    if (ctx.hasSidecar) {
      const reqIn = getRequestErrorsStatus(requests.inboundErrorRatio);
      const reqOut = getRequestErrorsStatus(requests.outboundErrorRatio);
      const both = mergeStatus(reqIn.status, reqOut.status);
      const item: HealthItem = {
        title: 'Error Rate over ' + getName(ctx.rateInterval).toLowerCase(),
        status: both,
        children: [getRequestErrorsSubItem(reqIn, 'Inbound'), getRequestErrorsSubItem(reqOut, 'Outbound')]
      };
      items.push(item);
    }
    return items;
  }

  constructor(workloadStatuses: WorkloadStatus[], public requests: RequestHealth, ctx: HealthContext) {
    super(AppHealth.computeItems(workloadStatuses, requests, ctx));
  }
}

export class WorkloadHealth extends Health {
  public static fromJson = (json: any, ctx: HealthContext) =>
    new WorkloadHealth(json.workloadStatus, json.requests, ctx);

  private static computeItems(
    workloadStatus: WorkloadStatus,
    requests: RequestHealth,
    ctx: HealthContext
  ): HealthItem[] {
    const items: HealthItem[] = [];
    {
      // Pods
      const podsStatus = ratioCheck(
        workloadStatus.availableReplicas,
        workloadStatus.currentReplicas,
        workloadStatus.desiredReplicas
      );
      const item: HealthItem = {
        title: 'Pods Status',
        status: podsStatus,
        text: String(workloadStatus.availableReplicas + ' / ' + workloadStatus.desiredReplicas)
      };
      if (podsStatus !== NA && podsStatus !== HEALTHY) {
        item.children = [
          {
            status: podsStatus,
            text: String(
              workloadStatus.desiredReplicas + ' desired pod' + (workloadStatus.desiredReplicas !== 1 ? 's' : '')
            )
          },
          {
            status: podsStatus,
            text: String(
              workloadStatus.currentReplicas + ' current pod' + (workloadStatus.currentReplicas !== 1 ? 's' : '')
            )
          },
          {
            status: podsStatus,
            text: String(
              workloadStatus.availableReplicas + ' available pod' + (workloadStatus.availableReplicas !== 1 ? 's' : '')
            )
          }
        ];
      }
      items.push(item);
    }
    // Request errors
    if (ctx.hasSidecar) {
      const reqIn = getRequestErrorsStatus(requests.inboundErrorRatio);
      const reqOut = getRequestErrorsStatus(requests.outboundErrorRatio);
      const both = mergeStatus(reqIn.status, reqOut.status);
      const item: HealthItem = {
        title: 'Error Rate over ' + getName(ctx.rateInterval).toLowerCase(),
        status: both,
        children: [getRequestErrorsSubItem(reqIn, 'Inbound'), getRequestErrorsSubItem(reqOut, 'Outbound')]
      };
      items.push(item);
    }
    return items;
  }

  constructor(workloadStatus: WorkloadStatus, public requests: RequestHealth, ctx: HealthContext) {
    super(WorkloadHealth.computeItems(workloadStatus, requests, ctx));
  }
}

export const healthNotAvailable = (): AppHealth => {
  return new AppHealth(
    [],
    { errorRatio: -1, inboundErrorRatio: -1, outboundErrorRatio: -1 },
    { rateInterval: 60, hasSidecar: true }
  );
};

export type NamespaceAppHealth = { [app: string]: AppHealth };
export type NamespaceServiceHealth = { [service: string]: ServiceHealth };
export type NamespaceWorkloadHealth = { [workload: string]: WorkloadHealth };

export type WithAppHealth<T> = T & { health: AppHealth };
export type WithServiceHealth<T> = T & { health: ServiceHealth };
export type WithWorkloadHealth<T> = T & { health: WorkloadHealth };
