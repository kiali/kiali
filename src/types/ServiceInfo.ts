import { ServiceHealth } from './Health';
import { PfColors } from '../components/Pf/PfColors';
import { Pod, Port, ObjectCheck, ObjectValidation, DestinationRules, VirtualServices } from './IstioObjects';
import { Route } from '../components/InfoRoutes/InfoRoutes';

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

export interface SourceWorkload {
  name: string;
  namespace: string;
}

// Istio Sidecar

export const hasIstioSidecar = (pods?: Pod[]) => {
  if (pods) {
    return pods.find(pod => pod.istioContainers != null) !== undefined;
  }
  return false;
};

export interface Service {
  labels?: { [key: string]: string };
  type: string;
  name: string;
  createdAt: string;
  resourceVersion: string;
  ip: string;
  ports?: Port[];
}

export interface ServiceDetailsInfo {
  service: Service;
  endpoints?: Endpoints[];
  istioSidecar: boolean;
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  dependencies?: { [key: string]: Route[] };
  health?: ServiceHealth;
  workloads?: WorkloadOverview[];
}

const higherThan = [
  'error-warning',
  'error-improvement',
  'error-correct',
  'warning-improvement',
  'warning-correct',
  'improvement-correct'
];

const IconSeverityMap = new Map<string, string>([
  ['error', 'error-circle-o'],
  ['warning', 'warning-triangle-o'],
  ['improvement', 'info'],
  ['correct', 'ok']
]);

const ColorSeverityMap = new Map<string, string>([
  ['error', PfColors.Red100],
  ['warning', PfColors.Orange400],
  ['improvement', PfColors.Blue400],
  ['correct', PfColors.Green400]
]);

export const severityToIconName = (severity: string): string => {
  let iconName = IconSeverityMap.get(severity);
  if (!iconName) {
    iconName = 'ok';
  }

  return iconName;
};

export const severityToColor = (severity: string): string => {
  let color = ColorSeverityMap.get(severity);
  if (!color) {
    color = 'black';
  }

  return color;
};

export const higherSeverity = (a: string, b: string): boolean => {
  return higherThan.includes(a + '-' + b);
};

export const highestSeverity = (checks: ObjectCheck[]): string => {
  let severity = 'correct';

  checks.forEach(check => {
    if (higherSeverity(check.severity, severity)) {
      severity = check.severity;
    }
  });

  return severity;
};

const numberOfChecks = (type: string, object: ObjectValidation) =>
  (object ? object.checks : []).filter(i => i.severity === type).length;

export const validationToSeverity = (object: ObjectValidation): string => {
  const warnChecks = numberOfChecks('warning', object);
  const errChecks = numberOfChecks('error', object);

  return object && object.valid
    ? 'correct'
    : object && !object.valid && errChecks > 0
    ? 'error'
    : object && !object.valid && warnChecks > 0
    ? 'warning'
    : 'correct';
};

export const validationToIconName = (object: ObjectValidation): string => {
  return severityToIconName(validationToSeverity(object));
};

export const checkForPath = (object: ObjectValidation, path: string): ObjectCheck[] => {
  if (!object) {
    return [];
  }

  let check = object.checks.filter(item => {
    return item.path === path;
  });

  return check;
};

export const globalChecks = (object: ObjectValidation): ObjectCheck[] => {
  return checkForPath(object, '');
};

export interface EditorLink {
  editorLink: string;
}
