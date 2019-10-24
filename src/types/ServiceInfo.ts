import { ServiceHealth } from './Health';
import {
  DestinationRules,
  ObjectCheck,
  ObjectValidation,
  Port,
  Validations,
  ValidationTypes,
  VirtualServices
} from './IstioObjects';
import { TLSStatus } from './TLSStatus';

export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: Port[];
}

interface EndpointAddress {
  ip: string;
  kind?: string;
  name?: string;
}

export interface WorkloadOverview {
  name: string;
  type: string;
  istioSidecar: boolean;
  labels?: { [key: string]: string };
  resourceVersion: string;
  createdAt: string;
}

export interface ApiDocumentation {
  type: string;
  hasSpec: boolean;
}

export interface Service {
  type: string;
  name: string;
  createdAt: string;
  resourceVersion: string;
  ip: string;
  ports?: Port[];
  externalName: string;
  labels?: { [key: string]: string };
  selectors?: { [key: string]: string };
}

export interface ServiceDetailsInfo {
  service: Service;
  endpoints?: Endpoints[];
  istioSidecar: boolean;
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  health?: ServiceHealth;
  workloads?: WorkloadOverview[];
  namespaceMTLS?: TLSStatus;
  errorTraces?: number;
  validations: Validations;
  apiDocumentation: ApiDocumentation;
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

const numberOfChecks = (type: ValidationTypes, object: ObjectValidation) =>
  (object && object.checks ? object.checks : []).filter(i => i.severity === type).length;

export const validationToSeverity = (object: ObjectValidation): ValidationTypes => {
  const warnChecks = numberOfChecks(ValidationTypes.Warning, object);
  const errChecks = numberOfChecks(ValidationTypes.Error, object);

  return object && object.valid
    ? ValidationTypes.Correct
    : object && !object.valid && errChecks > 0
    ? ValidationTypes.Error
    : object && !object.valid && warnChecks > 0
    ? ValidationTypes.Warning
    : ValidationTypes.Correct;
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
