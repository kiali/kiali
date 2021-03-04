import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  UnknownIcon
} from '@patternfly/react-icons';
import { IconType } from '@patternfly/react-icons/dist/js/createIcon';
import { getName } from '../utils/RateIntervals';
import { PFAlertColor, PfColors } from 'components/Pf/PfColors';
import { calculateErrorRate } from './ErrorRate';
import { ToleranceConfig } from './ServerConfig';
import { serverConfig } from '../config';
import { HealthAnnotationType } from './HealthAnnotation';

interface HealthConfig {
  items: HealthItem[];
  statusConfig?: HealthItemConfig;
}

export interface HealthItem {
  status: Status;
  title: string;
  text?: string;
  children?: HealthSubItem[];
}

export interface HealthItemConfig {
  status: Status;
  title: string;
  text?: string;
  value: number;
  threshold?: ToleranceConfig;
}

interface HealthSubItem {
  status: Status;
  text: string;
  value?: number;
}

export interface WorkloadStatus {
  name: string;
  desiredReplicas: number;
  currentReplicas: number;
  availableReplicas: number;
  syncedProxies: number;
}

export const TRAFFICSTATUS = 'Traffic Status';

const createTrafficTitle = (time: string) => {
  return TRAFFICSTATUS + ' (Last ' + time + ')';
};

/*
RequestType interface
- where the structure is type {<protocol>: {<code>:value ...} ...}

Example: { "http": {"200": 2, "404": 1 ...} ... }
*/
export interface RequestType {
  [key: string]: { [key: string]: number };
}
export interface RequestHealth {
  inbound: RequestType;
  outbound: RequestType;
  healthAnnotations: HealthAnnotationType;
}

export interface Status {
  name: string;
  color: string;
  priority: number;
  icon: IconType;
  class: string;
}

export interface ProxyStatus {
  CDS: string;
  EDS: string;
  LDS: string;
  RDS: string;
}

export const FAILURE: Status = {
  name: 'Failure',
  color: PFAlertColor.Danger,
  priority: 4,
  icon: ExclamationCircleIcon,
  class: 'icon-failure'
};
export const DEGRADED: Status = {
  name: 'Degraded',
  color: PFAlertColor.Warning,
  priority: 3,
  icon: ExclamationTriangleIcon,
  class: 'icon-degraded'
};
export const NOT_READY: Status = {
  name: 'Not Ready',
  color: PFAlertColor.InfoBackground,
  priority: 2,
  icon: MinusCircleIcon,
  class: 'icon-idle'
};
export const HEALTHY: Status = {
  name: 'Healthy',
  color: PFAlertColor.Success,
  priority: 1,
  icon: CheckCircleIcon,
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

export interface ThresholdStatus {
  value: number;
  status: Status;
  violation?: string;
}

const POD_STATUS = 'Pod Status';

// Use -1 rather than NaN to allow straigthforward comparison
export const RATIO_NA = -1;

export const ratioCheck = (
  availableReplicas: number,
  currentReplicas: number,
  desiredReplicas: number,
  syncedProxies: number
): Status => {
  /*
    NOT READY STATE
 */
  // User has scaled down a workload, then desired replicas will be 0 and it's not an error condition
  if (desiredReplicas === 0) {
    return NOT_READY;
  }

  /*
   DEGRADED STATE
  */
  // When a workload has available pods but less than desired defined by user it should be marked as degraded
  if (
    desiredReplicas > 0 &&
    currentReplicas > 0 &&
    availableReplicas > 0 &&
    (currentReplicas < desiredReplicas || availableReplicas < desiredReplicas)
  ) {
    return DEGRADED;
  }

  /*
     FAILURE STATE
  */
  // When availableReplicas is 0 but user has marked a desired > 0, that's an error condition
  if (desiredReplicas > 0 && availableReplicas === 0) {
    return FAILURE;
  }

  // Pending Pods means problems
  if (desiredReplicas === availableReplicas && availableReplicas !== currentReplicas) {
    return FAILURE;
  }

  // When there are proxies that are not sync, degrade
  if (syncedProxies >= 0 && syncedProxies < desiredReplicas) {
    return DEGRADED;
  }

  /*
     HEALTHY STATE
  */
  if (
    desiredReplicas === currentReplicas &&
    currentReplicas === availableReplicas &&
    availableReplicas === desiredReplicas
  ) {
    return HEALTHY;
  }

  // Other combination could mean a degraded situation
  return DEGRADED;
};

export const proxyStatusMessage = (syncedProxies: number, desiredReplicas: number): string => {
  let msg: string = '';
  if (syncedProxies < desiredReplicas) {
    const unsynced = desiredReplicas - syncedProxies;
    msg = ' (' + unsynced;
    msg += unsynced !== 1 ? ' proxies' : ' proxy';
    msg += ' unsynced)';
  }
  return msg;
};

export const isProxyStatusSynced = (status: ProxyStatus): boolean => {
  return (
    isProxyStatusComponentSynced(status.CDS) &&
    isProxyStatusComponentSynced(status.EDS) &&
    isProxyStatusComponentSynced(status.LDS) &&
    isProxyStatusComponentSynced(status.RDS)
  );
};

export const isProxyStatusComponentSynced = (componentStatus: string): boolean => {
  return componentStatus === 'Synced';
};

export const mergeStatus = (s1: Status, s2: Status): Status => {
  return s1.priority > s2.priority ? s1 : s2;
};

export const ascendingThresholdCheck = (value: number, thresholds: Thresholds): ThresholdStatus => {
  if (value > 0) {
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
  }

  return { value: value, status: HEALTHY };
};

export const getRequestErrorsStatus = (ratio: number, tolerance?: ToleranceConfig): ThresholdStatus => {
  if (tolerance && ratio >= 0) {
    let thresholds = {
      degraded: tolerance.degraded,
      failure: tolerance.failure,
      unit: '%'
    };
    return ascendingThresholdCheck(100 * ratio, thresholds);
  }

  return {
    value: RATIO_NA,
    status: NA
  };
};

export const getRequestErrorsSubItem = (thresholdStatus: ThresholdStatus, prefix: string): HealthSubItem => {
  return {
    status: thresholdStatus.status,
    text: prefix + ': ' + (thresholdStatus.status === NA ? 'No requests' : thresholdStatus.value.toFixed(2) + '%'),
    value: thresholdStatus.status === NA ? 0 : thresholdStatus.value
  };
};

export abstract class Health {
  constructor(public health: HealthConfig) {}

  getGlobalStatus(): Status {
    return this.health.items.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
  }

  getStatusConfig(): ToleranceConfig | undefined {
    // Check if the config applied is the kiali defaults one
    const tolConfDefault = serverConfig.healthConfig.rate[serverConfig.healthConfig.rate.length - 1].tolerance;
    for (let tol of tolConfDefault) {
      // Check if the tolerance applied is one of kiali defaults
      if (this.health.statusConfig && tol === this.health.statusConfig.threshold) {
        // In the case is a kiali's default return undefined
        return undefined;
      }
    }
    // Otherwise return the threshold configuration that kiali used to calculate the status
    return this.health.statusConfig?.threshold;
  }
}

interface HealthContext {
  rateInterval: number;
  hasSidecar: boolean;
}

export class ServiceHealth extends Health {
  public static fromJson = (ns: string, srv: string, json: any, ctx: HealthContext) =>
    new ServiceHealth(ns, srv, json.requests, ctx);

  private static computeItems(ns: string, srv: string, requests: RequestHealth, ctx: HealthContext): HealthConfig {
    const items: HealthItem[] = [];
    let statusConfig: HealthItemConfig | undefined = undefined;
    if (ctx.hasSidecar) {
      // Request errors
      const reqError = calculateErrorRate(ns, srv, 'service', requests);
      const reqErrorsText =
        reqError.errorRatio.global.status.status === NA
          ? 'No requests'
          : reqError.errorRatio.global.status.value.toFixed(2) + '%';
      const item: HealthItem = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: reqError.errorRatio.global.status.status,
        children: [
          {
            text: 'Inbound: ' + reqErrorsText,
            status: reqError.errorRatio.global.status.status,
            value: reqError.errorRatio.global.status.value
          }
        ]
      };
      items.push(item);
      statusConfig = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: reqError.errorRatio.global.status.status,
        threshold: reqError.errorRatio.global.toleranceConfig,
        value: reqError.errorRatio.global.status.value
      };
    } else {
      items.push({
        title: TRAFFICSTATUS,
        status: NA,
        text: 'No Istio sidecar'
      });
    }
    return { items, statusConfig };
  }

  constructor(ns: string, srv: string, public requests: RequestHealth, ctx: HealthContext) {
    super(ServiceHealth.computeItems(ns, srv, requests, ctx));
  }
}

export class AppHealth extends Health {
  public static fromJson = (ns: string, app: string, json: any, ctx: HealthContext) =>
    new AppHealth(ns, app, json.workloadStatuses, json.requests, ctx);

  private static computeItems(
    ns: string,
    app: string,
    workloadStatuses: WorkloadStatus[],
    requests: RequestHealth,
    ctx: HealthContext
  ): HealthConfig {
    const items: HealthItem[] = [];
    let statusConfig: HealthItemConfig | undefined = undefined;
    {
      // Pods
      const children: HealthSubItem[] = workloadStatuses.map(d => {
        const status = ratioCheck(d.availableReplicas, d.currentReplicas, d.desiredReplicas, d.syncedProxies);
        let proxyMessage = '';
        if (d.syncedProxies >= 0) {
          proxyMessage = proxyStatusMessage(d.syncedProxies, d.desiredReplicas);
        }
        return {
          text: d.name + ': ' + d.availableReplicas + ' / ' + d.desiredReplicas + proxyMessage,
          status: status
        };
      });
      const podsStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);
      const item: HealthItem = {
        title: POD_STATUS,
        status: podsStatus,
        children: children
      };
      items.push(item);
    }

    // Request errors
    if (ctx.hasSidecar) {
      const reqError = calculateErrorRate(ns, app, 'app', requests);
      const reqIn = reqError.errorRatio.inbound.status;
      const reqOut = reqError.errorRatio.outbound.status;
      const both = mergeStatus(reqIn.status, reqOut.status);
      const item: HealthItem = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: both,
        children: [getRequestErrorsSubItem(reqIn, 'Inbound'), getRequestErrorsSubItem(reqOut, 'Outbound')]
      };
      statusConfig = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: reqError.errorRatio.global.status.status,
        threshold: reqError.errorRatio.global.toleranceConfig,
        value: reqError.errorRatio.global.status.value
      };
      items.push(item);
    }
    return { items, statusConfig };
  }

  constructor(
    ns: string,
    app: string,
    workloadStatuses: WorkloadStatus[],
    public requests: RequestHealth,
    ctx: HealthContext
  ) {
    super(AppHealth.computeItems(ns, app, workloadStatuses, requests, ctx));
  }
}

export class WorkloadHealth extends Health {
  public static fromJson = (ns: string, workload: string, json: any, ctx: HealthContext) =>
    new WorkloadHealth(ns, workload, json.workloadStatus, json.requests, ctx);

  private static computeItems(
    ns: string,
    workload: string,
    workloadStatus: WorkloadStatus,
    requests: RequestHealth,
    ctx: HealthContext
  ): HealthConfig {
    const items: HealthItem[] = [];
    let statusConfig: HealthItemConfig | undefined = undefined;
    {
      // Pods
      const podsStatus = ratioCheck(
        workloadStatus.availableReplicas,
        workloadStatus.currentReplicas,
        workloadStatus.desiredReplicas,
        workloadStatus.syncedProxies
      );
      const item: HealthItem = {
        title: POD_STATUS,
        status: podsStatus,
        children: [
          {
            text:
              workloadStatus.name + ': ' + workloadStatus.availableReplicas + ' / ' + workloadStatus.desiredReplicas,
            status: podsStatus
          }
        ]
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

        if (workloadStatus.syncedProxies >= 0) {
          item.children.push({
            status: podsStatus,
            text: String(
              workloadStatus.syncedProxies + ' synced prox' + (workloadStatus.availableReplicas !== 1 ? 'ies' : 'y')
            )
          });
        }
      }
      items.push(item);
    }
    // Request errors
    if (ctx.hasSidecar) {
      const reqError = calculateErrorRate(ns, workload, 'workload', requests);
      const reqIn = reqError.errorRatio.inbound.status;
      const reqOut = reqError.errorRatio.outbound.status;
      const both = mergeStatus(reqIn.status, reqOut.status);
      const item: HealthItem = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: both,
        children: [getRequestErrorsSubItem(reqIn, 'Inbound'), getRequestErrorsSubItem(reqOut, 'Outbound')]
      };
      items.push(item);

      statusConfig = {
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: reqError.errorRatio.global.status.status,
        threshold: reqError.errorRatio.global.toleranceConfig,
        value: reqError.errorRatio.global.status.value
      };
    }
    return { items, statusConfig };
  }

  constructor(
    ns: string,
    workload: string,
    workloadStatus: WorkloadStatus,
    public requests: RequestHealth,
    ctx: HealthContext
  ) {
    super(WorkloadHealth.computeItems(ns, workload, workloadStatus, requests, ctx));
  }
}

export const healthNotAvailable = (): AppHealth => {
  return new AppHealth(
    '',
    '',
    [],
    { inbound: {}, outbound: {}, healthAnnotations: {} },
    { rateInterval: 60, hasSidecar: true }
  );
};

export type NamespaceAppHealth = { [app: string]: AppHealth };
export type NamespaceServiceHealth = { [service: string]: ServiceHealth };
export type NamespaceWorkloadHealth = { [workload: string]: WorkloadHealth };

export type WithAppHealth<T> = T & { health: AppHealth };
export type WithServiceHealth<T> = T & { health: ServiceHealth };
export type WithWorkloadHealth<T> = T & { health: WorkloadHealth };

export type WithHealth<T> = WithAppHealth<T> | WithServiceHealth<T> | WithWorkloadHealth<T>;
export const hasHealth = <T>(val: T): val is WithHealth<T> => !!val['health'];
