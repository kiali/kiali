import { DEGRADED, FAILURE, HEALTHY, NA, ServiceHealth, Status } from './Health';
import {
  DestinationRule,
  getWizardUpdateLabel,
  K8sHTTPRoute,
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
import { KIALI_WIZARD_LABEL } from '../components/IstioWizards/WizardActions';
import { ServiceOverview } from './ServiceList';

export interface ServicePort {
  appProtocol?: string;
  istioProtocol: string;
  name: string;
  port: number;
  protocol: string;
  tlsMode: string;
}

export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: ServicePort[];
}

interface EndpointAddress {
  ip: string;
  istioProtocol?: string;
  kind?: string;
  name?: string;
  tlsMode?: string;
}

export interface WorkloadOverview {
  createdAt: string;
  istioAmbient: boolean;
  istioSidecar: boolean;
  labels?: { [key: string]: string };
  name: string;
  resourceVersion: string;
  serviceAccountNames: string[];
  type: string;
}

export interface Service {
  additionalDetails: AdditionalItem[];
  annotations: { [key: string]: string };
  cluster?: string;
  createdAt: string;
  externalName: string;
  ip: string;
  labels?: { [key: string]: string };
  name: string;
  ports?: ServicePort[];
  resourceVersion: string;
  selectors?: { [key: string]: string };
  type: string;
}

export interface ServiceDetailsInfo {
  destinationRules: DestinationRule[];
  endpoints?: Endpoints[];
  health?: ServiceHealth;
  istioAmbient: boolean;
  istioPermissions: ResourcePermissions;
  istioSidecar: boolean;
  k8sHTTPRoutes: K8sHTTPRoute[];
  namespaceMTLS?: TLSStatus;
  service: Service;
  serviceEntries: ServiceEntry[];
  subServices?: ServiceOverview[];
  validations: Validations;
  virtualServices: VirtualService[];
  workloads?: WorkloadOverview[];
}

// Type guard to distinguish between ServiceDetailsInfo and VirtualService[].
// Only use it for that otherwise you'll likely to get false positives.
export function isServiceDetailsInfo(obj: any): obj is ServiceDetailsInfo {
  return !Array.isArray(obj);
}

export interface ServiceDetailsQuery {
  rateInterval?: string;
  validate?: boolean;
}

export interface ServiceUpdateQuery {
  patchType?: string;
}

export const getServiceDetailsUpdateLabel = (serviceDetails: ServiceDetailsInfo | null): string => {
  return getWizardUpdateLabel(serviceDetails?.virtualServices ?? null, serviceDetails?.k8sHTTPRoutes ?? null);
};

export function hasServiceDetailsTrafficRouting(serviceDetails: ServiceDetailsInfo | null): boolean;

export function hasServiceDetailsTrafficRouting(
  vsList: VirtualService[],
  drList: DestinationRule[],
  routeList?: K8sHTTPRoute[]
): boolean;

export function hasServiceDetailsTrafficRouting(
  serviceDetailsOrVsList: ServiceDetailsInfo | VirtualService[] | null,
  drList?: DestinationRule[],
  routeList?: K8sHTTPRoute[]
): boolean {
  let virtualServicesList: VirtualService[];
  let destinationRulesList: DestinationRule[];
  let httpRoutesList: K8sHTTPRoute[];

  if (serviceDetailsOrVsList === null) {
    return false;
  }

  if ('length' in serviceDetailsOrVsList) {
    virtualServicesList = serviceDetailsOrVsList;
    destinationRulesList = drList ?? [];
    httpRoutesList = routeList ?? [];
  } else {
    virtualServicesList = serviceDetailsOrVsList.virtualServices;
    destinationRulesList = serviceDetailsOrVsList.destinationRules;
    httpRoutesList = serviceDetailsOrVsList.k8sHTTPRoutes;
  }

  return virtualServicesList.length > 0 || destinationRulesList.length > 0 || httpRoutesList.length > 0;
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
  return higherThan.includes(`${a}-${b}`);
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

const numberOfChecks = (type: ValidationTypes, object: ObjectValidation): number =>
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

export function getServiceWizardLabel(serviceDetails: Service): string {
  if (serviceDetails && serviceDetails.labels && serviceDetails.labels[KIALI_WIZARD_LABEL]) {
    return serviceDetails.labels[KIALI_WIZARD_LABEL];
  } else {
    return '';
  }
}

export function getServicePort(ports: { [key: string]: number }): number {
  let port = 80;

  if (ports) {
    port = Object.values(ports)[0];
  }

  return port;
}
