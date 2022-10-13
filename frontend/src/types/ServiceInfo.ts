import { DEGRADED, FAILURE, HEALTHY, NA, ServiceHealth, Status } from './Health';
import {
  DestinationRule,
  getVirtualServiceUpdateLabel, K8sHTTPRoute,
  ObjectCheck,
  ObjectValidation,
  ServiceEntry,
  Validations,
  ValidationTypes,
  VirtualService
} from './IstioObjects';
import { TLSStatus } from './TLSStatus';
import { AdditionalItem } from './Workload';
import { ResourcePermissions } from './Permissions';

export interface ServicePort {
  name: string;
  port: number;
  protocol: string;
  appProtocol?: string;
  istioProtocol: string;
  tlsMode: string;
}

export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: ServicePort[];
}

interface EndpointAddress {
  ip: string;
  kind?: string;
  name?: string;
  istioProtocol?: string;
  tlsMode?: string;
}

export interface WorkloadOverview {
  name: string;
  type: string;
  istioSidecar: boolean;
  labels?: { [key: string]: string };
  resourceVersion: string;
  createdAt: string;
  serviceAccountNames: string[];
}

export interface Service {
  type: string;
  name: string;
  createdAt: string;
  resourceVersion: string;
  ip: string;
  ports?: ServicePort[];
  externalName: string;
  labels?: { [key: string]: string };
  selectors?: { [key: string]: string };
}

export interface ServiceDetailsInfo {
  service: Service;
  endpoints?: Endpoints[];
  istioSidecar: boolean;
  virtualServices: VirtualService[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  destinationRules: DestinationRule[];
  serviceEntries: ServiceEntry[];
  istioPermissions: ResourcePermissions;
  health?: ServiceHealth;
  workloads?: WorkloadOverview[];
  namespaceMTLS?: TLSStatus;
  validations: Validations;
  additionalDetails: AdditionalItem[];
}

export function getServiceDetailsUpdateLabel(serviceDetails: ServiceDetailsInfo | null) {
  return getVirtualServiceUpdateLabel(serviceDetails?.virtualServices || null);
}

export function hasServiceDetailsTrafficRouting(serviceDetails: ServiceDetailsInfo | null);
export function hasServiceDetailsTrafficRouting(vsList: VirtualService[], drList: DestinationRule[]);
export function hasServiceDetailsTrafficRouting(serviceDetailsOrVsList: ServiceDetailsInfo | VirtualService[] | null, drList?: DestinationRule[]) {
  let virtualServicesList: VirtualService[];
  let destinationRulesList: DestinationRule[];

  if (serviceDetailsOrVsList === null) {
    return false;
  }

  if ('length' in serviceDetailsOrVsList) {
    virtualServicesList = serviceDetailsOrVsList;
    destinationRulesList = drList || [];
  } else {
    virtualServicesList = serviceDetailsOrVsList.virtualServices;
    destinationRulesList = serviceDetailsOrVsList.destinationRules;
  }

  return virtualServicesList.length > 0 || destinationRulesList.length > 0;
}

const higherThan = [
  'error-warning',
  'error-improvement',
  'error-correct',
  'warning-improvement',
  'warning-correct',
  'improvement-correct'
];

export const higherSeverity = (a: ValidationTypes, b: ValidationTypes): boolean => {
  return higherThan.includes(a + '-' + b);
};

export const highestSeverity = (checks: ObjectCheck[]): ValidationTypes => {
  let severity: ValidationTypes = ValidationTypes.Correct;

  checks.forEach(check => {
    if (higherSeverity(check.severity, severity)) {
      severity = check.severity;
    }
  });

  return severity;
};

export const validationToHealth = (severity: ValidationTypes): Status => {
  let status: Status = NA;
  if (severity === ValidationTypes.Correct) {
    status = HEALTHY;
  } else if (severity === ValidationTypes.Warning) {
    status = DEGRADED;
  } else if (severity === ValidationTypes.Error) {
    status = FAILURE;
  }
  return status;
};

const numberOfChecks = (type: ValidationTypes, object: ObjectValidation) =>
  (object && object.checks ? object.checks : []).filter(i => i.severity === type).length;

export const validationToSeverity = (object: ObjectValidation): ValidationTypes => {
  const warnChecks = numberOfChecks(ValidationTypes.Warning, object);
  const errChecks = numberOfChecks(ValidationTypes.Error, object);
  return errChecks > 0 ? ValidationTypes.Error : warnChecks > 0 ? ValidationTypes.Warning : ValidationTypes.Correct;
};

export const checkForPath = (object: ObjectValidation | undefined, path: string): ObjectCheck[] => {
  if (!object || !object.checks) {
    return [];
  }

  return object.checks.filter(item => {
    return item.path === path;
  });
};

export const globalChecks = (object: ObjectValidation): ObjectCheck[] => {
  return checkForPath(object, '');
};
