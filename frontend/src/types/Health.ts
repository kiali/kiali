import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InfoCircleIcon,
  MinusCircleIcon,
  UnknownIcon
} from '@patternfly/react-icons';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { getName } from '../utils/RateIntervals';
import { PFColors } from 'components/Pf/PfColors';
import { calculateErrorRate } from './ErrorRate';
import { ToleranceConfig } from './ServerConfig';
import { serverConfig } from '../config';
import { HealthAnnotationType } from './HealthAnnotation';
import { t } from 'utils/I18nUtils';

interface HealthConfig {
  items: HealthItem[];
  statusConfig?: HealthItemConfig;
}

export const enum HealthItemType {
  TRAFFIC_STATUS = 'traffic_status',
  POD_STATUS = 'pod_status'
}

export interface HealthItem {
  children?: HealthSubItem[];
  status: Status;
  text?: string;
  title: string;
  type: HealthItemType;
}

// CalculatedHealthStatus represents the pre-calculated health status from the backend
// When present, this should be used instead of client-side calculation
export interface CalculatedHealthStatus {
  errorRatio?: number; // Error ratio as percentage (0-100)
  status: string; // "Healthy", "Degraded", "Failure", "Not Ready", "NA"
}

// Map backend status string to frontend Status object
export const statusFromString = (statusStr: string): Status => {
  switch (statusStr) {
    case 'Healthy':
      return HEALTHY;
    case 'Degraded':
      return DEGRADED;
    case 'Failure':
      return FAILURE;
    case 'Not Ready':
      return NOT_READY;
    case 'NA':
    default:
      return NA;
  }
};

export interface HealthItemConfig {
  status: Status;
  text?: string;
  threshold?: ToleranceConfig;
  title: string;
  value: number;
}

export interface HealthSubItem {
  status: Status;
  text: string;
  value?: number;
}

export interface WorkloadStatus {
  availableReplicas: number;
  currentReplicas: number;
  desiredReplicas: number;
  name: string;
  syncedProxies: number;
}

export interface AppHealthResponse {
  requests: RequestHealth;
  workloadStatuses: WorkloadStatus[];
}

export interface WorkloadHealthResponse {
  requests: RequestHealth;
  workloadStatus: WorkloadStatus;
}

const createTrafficTitle = (time: string): string => {
  return t('Traffic Status (Last {{duration}})', { duration: time });
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
  healthAnnotations: HealthAnnotationType;
  inbound: RequestType;
  outbound: RequestType;
}

// Valid health status IDs that match backend HealthStatus values
export type HealthStatusId = 'Healthy' | 'Degraded' | 'Failure' | 'Not Ready' | 'NA';

export interface Status {
  className: string;
  color: string;
  icon: React.ComponentClass<SVGIconProps>;
  id: HealthStatusId | 'Info'; // 'Info' is used for validation/proxy status display, not health
  name: string;
  priority: number;
  status: string;
}

export interface ProxyStatus {
  CDS: string;
  EDS: string;
  LDS: string;
  RDS: string;
}

export const FAILURE: Status = {
  className: 'icon-failure',
  color: PFColors.Danger,
  icon: ExclamationCircleIcon,
  id: 'Failure',
  name: t('Failure'),
  priority: 4,
  status: 'danger'
};

export const DEGRADED: Status = {
  className: 'icon-degraded',
  color: PFColors.Warning,
  icon: ExclamationTriangleIcon,
  id: 'Degraded',
  name: t('Degraded'),
  priority: 3,
  status: 'warning'
};

export const INFO: Status = {
  className: 'icon-info',
  color: PFColors.Info,
  icon: InfoCircleIcon,
  id: 'Info',
  name: t('Info'),
  priority: 2,
  status: 'info'
};

export const NOT_READY: Status = {
  className: 'icon-idle',
  color: PFColors.Info,
  icon: MinusCircleIcon,
  id: 'Not Ready',
  name: t('Not Ready'),
  priority: 2,
  status: 'custom'
};

export const HEALTHY: Status = {
  className: 'icon-healthy',
  color: PFColors.Success,
  icon: CheckCircleIcon,
  id: 'Healthy',
  name: t('Healthy'),
  priority: 1,
  status: 'success'
};

export const NA: Status = {
  className: 'icon-na',
  color: PFColors.Color200,
  icon: UnknownIcon,
  id: 'NA',
  name: t('No health information'),
  priority: 0,
  status: 'custom'
};

interface Thresholds {
  degraded: number;
  failure: number;
  unit: string;
}

export interface ThresholdStatus {
  status: Status;
  value: number;
  violation?: string;
}

export const POD_STATUS = 'pod_status';

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
  let msg = '';
  if (syncedProxies < desiredReplicas) {
    const unsynced = desiredReplicas - syncedProxies;
    msg = ` (${unsynced} ${unsynced !== 1 ? 'proxies' : 'proxy'} unsynced)`;
  }
  return msg;
};

export const hasProxyStatusInfoSeverity = (status: ProxyStatus): boolean => {
  return (
    isProxyStatusComponentSyncedOrIgnored(status.CDS) &&
    isProxyStatusComponentSyncedOrIgnored(status.EDS) &&
    isProxyStatusComponentSyncedOrIgnored(status.LDS) &&
    isProxyStatusComponentSyncedOrIgnored(status.RDS) &&
    !isProxyStatusSynced(status)
  );
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
  return componentStatus.toLowerCase() === 'synced';
};

export const isProxyStatusComponentSyncedOrIgnored = (componentStatus: string): boolean => {
  return componentStatus.toLowerCase() === 'synced' || componentStatus.toLowerCase() === 'ignored';
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
        violation: `${value.toFixed(2)}${thresholds.unit}>=${thresholds.failure}${thresholds.unit}`
      };
    } else if (value >= thresholds.degraded) {
      return {
        value: value,
        status: DEGRADED,
        violation: `${value.toFixed(2)}${thresholds.unit}>=${thresholds.degraded}${thresholds.unit}`
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
    text: `${prefix}: ${thresholdStatus.status === NA ? 'No requests' : `${thresholdStatus.value.toFixed(2)}%`}`,
    value: thresholdStatus.status === NA ? 0 : thresholdStatus.value
  };
};

export const isRequestHealthNotEmpty = (requests: RequestHealth): boolean => {
  return (
    requests &&
    (Object.keys(requests.inbound).length > 0 ||
      Object.keys(requests.outbound).length > 0 ||
      Object.keys(requests.healthAnnotations).length > 0)
  );
};

export abstract class Health {
  // Optional pre-calculated status from the backend
  public backendStatus?: CalculatedHealthStatus;

  constructor(public health: HealthConfig, backendStatus?: CalculatedHealthStatus) {
    this.backendStatus = backendStatus;
  }

  // Returns the health status calculated by the backend.
  // If no backend status is available, returns NA.
  getStatus(): Status {
    if (this.backendStatus?.status) {
      return statusFromString(this.backendStatus.status);
    }
    return NA;
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

  getTrafficStatus(): HealthItem | undefined {
    for (let i = 0; i < this.health.items.length; i++) {
      const item = this.health.items[i];

      if (item.type === HealthItemType.TRAFFIC_STATUS) {
        return item;
      }
    }

    return undefined;
  }

  getWorkloadStatus(): HealthItem | undefined {
    for (let i = 0; i < this.health.items.length; i++) {
      const item = this.health.items[i];

      if (item.type === HealthItemType.POD_STATUS) {
        return item;
      }
    }

    return undefined;
  }
}

interface HealthContext {
  hasAmbient?: boolean;
  hasSidecar?: boolean;
  rateInterval: number;
}

export class ServiceHealth extends Health {
  public static fromJson = (ns: string, srv: string, json: any, ctx: HealthContext): ServiceHealth =>
    new ServiceHealth(ns, srv, json.requests, ctx, json.status);

  // Factory method for list pages that only need backend-calculated status
  public static fromBackendStatus = (json: any): ServiceHealth => {
    const health = new ServiceHealth('', '', { inbound: {}, outbound: {}, healthAnnotations: {} }, { rateInterval: 0 });
    health.backendStatus = json.status;
    return health;
  };

  private static computeItems(ns: string, srv: string, requests: RequestHealth, ctx: HealthContext): HealthConfig {
    const items: HealthItem[] = [];
    let statusConfig: HealthItemConfig | undefined = undefined;

    // hasAmbient and hasSidecars can be false, but still health requests have info
    if (ctx.hasSidecar || ctx.hasAmbient || isRequestHealthNotEmpty(requests)) {
      // Request errors
      const reqError = calculateErrorRate(ns, srv, 'service', requests);
      const reqErrorsText =
        reqError.errorRatio.global.status.status === NA
          ? 'No requests'
          : `${reqError.errorRatio.global.status.value.toFixed(2)}%`;

      const item: HealthItem = {
        type: HealthItemType.TRAFFIC_STATUS,
        title: createTrafficTitle(getName(ctx.rateInterval).toLowerCase()),
        status: reqError.errorRatio.global.status.status,
        children: [
          {
            text: `Inbound: ${reqErrorsText}`,
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
        type: HealthItemType.TRAFFIC_STATUS,
        title: t('Traffic Status'),
        status: NA,
        text: NA.name
      });
    }
    return { items, statusConfig };
  }

  constructor(
    ns: string,
    srv: string,
    public requests: RequestHealth,
    ctx: HealthContext,
    backendStatus?: CalculatedHealthStatus
  ) {
    super(ServiceHealth.computeItems(ns, srv, requests, ctx), backendStatus);
  }
}

export class AppHealth extends Health {
  public static fromJson = (ns: string, app: string, json: any, ctx: HealthContext): AppHealth =>
    new AppHealth(ns, app, json.workloadStatuses, json.requests, ctx, json.status);

  // Factory method for list pages that only need backend-calculated status
  public static fromBackendStatus = (json: any): AppHealth => {
    const health = new AppHealth('', '', [], { inbound: {}, outbound: {}, healthAnnotations: {} }, { rateInterval: 0 });
    health.backendStatus = json.status;
    return health;
  };

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
          text: `${d.name}: ${d.availableReplicas} / ${d.desiredReplicas}${proxyMessage}`,
          status: status
        };
      });

      const podsStatus = children.map(i => i.status).reduce((prev, cur) => mergeStatus(prev, cur), NA);

      const item: HealthItem = {
        type: HealthItemType.POD_STATUS,
        title: t('Pod Status'),
        status: podsStatus,
        children: children
      };

      items.push(item);
    }

    // Request errors
    // hasAmbient and hasSidecars can be false, but still health requests have info
    if (ctx.hasSidecar || ctx.hasAmbient || isRequestHealthNotEmpty(requests)) {
      const reqError = calculateErrorRate(ns, app, 'app', requests);
      const reqIn = reqError.errorRatio.inbound.status;
      const reqOut = reqError.errorRatio.outbound.status;
      const both = mergeStatus(reqIn.status, reqOut.status);

      const item: HealthItem = {
        type: HealthItemType.TRAFFIC_STATUS,
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
    ctx: HealthContext,
    backendStatus?: CalculatedHealthStatus
  ) {
    super(AppHealth.computeItems(ns, app, workloadStatuses, requests, ctx), backendStatus);
  }
}

export class WorkloadHealth extends Health {
  public static fromJson = (ns: string, workload: string, json: any, ctx: HealthContext): WorkloadHealth =>
    new WorkloadHealth(ns, workload, json.workloadStatus, json.requests, ctx, json.status);

  // Factory method for list pages that only need backend-calculated status
  public static fromBackendStatus = (json: any): WorkloadHealth => {
    const emptyWorkloadStatus = {
      name: '',
      desiredReplicas: 0,
      currentReplicas: 0,
      availableReplicas: 0,
      syncedProxies: -1
    };
    const health = new WorkloadHealth(
      '',
      '',
      emptyWorkloadStatus,
      { inbound: {}, outbound: {}, healthAnnotations: {} },
      { rateInterval: 0 }
    );
    health.backendStatus = json.status;
    return health;
  };

  private static computeItems(
    ns: string,
    workload: string,
    workloadStatus: WorkloadStatus,
    requests: RequestHealth,
    ctx: HealthContext
  ): HealthConfig {
    const items: HealthItem[] = [];
    let statusConfig: HealthItemConfig | undefined = undefined;

    if (workloadStatus) {
      // Pods
      const podsStatus = ratioCheck(
        workloadStatus.availableReplicas,
        workloadStatus.currentReplicas,
        workloadStatus.desiredReplicas,
        workloadStatus.syncedProxies
      );

      const item: HealthItem = {
        type: HealthItemType.POD_STATUS,
        title: t('Pod Status'),
        status: podsStatus,
        children: [
          {
            text: `${workloadStatus.name}: ${workloadStatus.availableReplicas} / ${workloadStatus.desiredReplicas}`,
            status: podsStatus
          }
        ]
      };

      if (podsStatus !== NA && podsStatus !== HEALTHY) {
        item.children = [
          {
            status: podsStatus,
            text: String(
              `${workloadStatus.desiredReplicas} desired pod${workloadStatus.desiredReplicas !== 1 ? 's' : ''}`
            )
          },
          {
            status: podsStatus,
            text: String(
              `${workloadStatus.currentReplicas} current pod${workloadStatus.currentReplicas !== 1 ? 's' : ''}`
            )
          },
          {
            status: podsStatus,
            text: String(
              `${workloadStatus.availableReplicas} available pod${workloadStatus.availableReplicas !== 1 ? 's' : ''}`
            )
          }
        ];

        if (workloadStatus.syncedProxies >= 0) {
          item.children.push({
            status: podsStatus,
            text: String(
              `${workloadStatus.syncedProxies} synced prox${workloadStatus.availableReplicas !== 1 ? 'ies' : 'y'}`
            )
          });
        }
      }

      items.push(item);
    }

    // Request errors
    // hasAmbient and hasSidecars can be false, but still health requests have info
    if (ctx.hasSidecar || ctx.hasAmbient || isRequestHealthNotEmpty(requests)) {
      const reqError = calculateErrorRate(ns, workload, 'workload', requests);
      const reqIn = reqError.errorRatio.inbound.status;
      const reqOut = reqError.errorRatio.outbound.status;
      const both = mergeStatus(reqIn.status, reqOut.status);

      const item: HealthItem = {
        type: HealthItemType.TRAFFIC_STATUS,
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
    ctx: HealthContext,
    backendStatus?: CalculatedHealthStatus
  ) {
    super(WorkloadHealth.computeItems(ns, workload, workloadStatus, requests, ctx), backendStatus);
  }
}

export const healthNotAvailable = (): AppHealth => {
  return new AppHealth(
    '',
    '',
    [],
    { inbound: {}, outbound: {}, healthAnnotations: {} },
    { rateInterval: 60, hasSidecar: true, hasAmbient: false }
  );
};

export type NamespaceAppHealth = { [app: string]: AppHealth };
export type NamespaceServiceHealth = { [service: string]: ServiceHealth };
export type NamespaceWorkloadHealth = { [workload: string]: WorkloadHealth };

export type NamespaceHealth = {
  appHealth: NamespaceAppHealth;
  serviceHealth: NamespaceServiceHealth;
  workloadHealth: NamespaceWorkloadHealth;
};

export type WithAppHealth<T> = T & { health: AppHealth };
export type WithServiceHealth<T> = T & { health: ServiceHealth };
export type WithWorkloadHealth<T> = T & { health: WorkloadHealth };

export type WithHealth<T> = WithAppHealth<T> | WithServiceHealth<T> | WithWorkloadHealth<T>;
export const hasHealth = <T>(val: T): val is WithHealth<T> => !!val['health'];

export interface NamespaceHealthQuery {
  queryTime?: string;
  rateInterval?: string;
  type: string;
}
