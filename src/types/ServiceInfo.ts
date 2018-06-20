import { Health } from './Health';

export interface Endpoints {
  addresses?: EndpointAddress[];
  ports?: Port[];
}

interface EndpointAddress {
  ip: string;
  kind?: string;
  name?: string;
}

export interface Port {
  protocol: string;
  port: number;
  name: string;
}

export interface Pod {
  name: string;
  labels?: { [key: string]: string };
  createdAt: string;
  createdBy: Reference[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
}

export interface Reference {
  name: string;
  kind: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
}

export interface Deployment {
  name: string;
  templateAnnotations?: { [key: string]: string };
  labels?: { [key: string]: string };
  createdAt: string;
  resourceVersion: string;
  replicas: number;
  availableReplicas: number;
  unavailableReplicas: number;
  autoscaler: Autoscaler;
}

export interface Autoscaler {
  name: string;
  labels?: { [key: string]: string };
  minReplicas: number;
  maxReplicas: number;
  targetCPUUtilizationPercentage: number;
  currentReplicas?: number;
  desiredReplicas?: number;
}

// RouteRule type

export interface RouteRule {
  name: string;
  createdAt: string;
  resourceVersion: string;
  destination?: IstioService;
  precedence?: number;
  match?: MatchCondition;
  route?: DestinationWeight[];
  redirect?: HTTPRedirect;
  rewrite?: HTTPRewrite;
  websocketUpgrade?: string;
  httpReqTimeout?: HTTPTimeout;
  httpReqRetries?: HTTPRetry;
  httpFault?: HTTPFaultInjection;
  l4Fault?: L4FaultInjection;
  mirror?: IstioService;
  corsPolicy?: CorsPolicy;
  appendHeaders?: { [key: string]: string };
}

export interface IstioService {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: { [key: string]: string };
}

export interface MatchCondition {
  source?: IstioService;
  tcp?: L4MatchAttributes;
  udp?: L4MatchAttributes;
  request?: MatchRequest;
}

export interface L4MatchAttributes {
  sourceSubnet: string[];
  destinationSubnet: string[];
}

export interface MatchRequest {
  headers: { [key: string]: StringMatch };
}

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface DestinationWeight {
  labels: { [key: string]: string };
  weight?: number;
}

export interface HTTPRedirect {
  uri: string;
  authority: string;
}

export interface HTTPRewrite {
  uri: string;
  authority: string;
}

export interface HTTPTimeout {
  simpleTimeout: SimpleTimeoutPolicy;
  custom: string;
}

export interface SimpleTimeoutPolicy {
  timeout: string;
  overrideHeaderName: string;
}

export interface HTTPRetry {
  simpleRetry: SimpleRetryPolicy;
  custom: string;
}

export interface SimpleRetryPolicy {
  attempts: number;
  perTryTimeout: string;
  overrideHeaderName: string;
}

export interface HTTPFaultInjection {
  delay: Delay;
  abort: Abort;
}

export interface Delay {
  percent: number;
  fixedDelay: string;
  exponentialDelay: string;
  overrideHeaderName: string;
}

export interface Abort {
  percent: number;
  grpcStatus: string;
  http2Error: string;
  httpStatus: string;
  overrideHeaderName: string;
}

export interface L4FaultInjection {
  throttle: Throttle;
  terminate: Terminate;
}

export interface Throttle {
  percent: number;
  downstreamLimitBps: number;
  upstreamLimitBps: number;
  throttleAfterPeriod: string;
  throttleAfterBytes: number;
  throttleForPeriod: string;
}

export interface Terminate {
  percent: number;
  terminateAfterPeriod: string;
}

export interface CorsPolicy {
  allowOrigin: string[];
  allowMethods: string[];
  allowHeaders: string[];
  exposeHeaders: string[];
  maxAge: string;
  allowCredentials: string;
}

// Destination Policy

export interface LoadBalancing {
  name: string;
}

export interface CircuitBreakerPolicy {
  maxConnections?: number;
  httpMaxPendingRequests?: number;
  httpMaxRequests?: number;
  sleepWindow?: string;
  httpConsecutiveErrors?: string;
  httpDetectionInterval?: string;
  httpMaxRequestsPerConnection?: number;
  httpMaxEjectionPercent?: number;
  httpMaxRetries?: number;
}

export interface CircuitBreaker {
  simpleCb: CircuitBreakerPolicy;
  custom: string;
}

export interface DestinationPolicy {
  name: string;
  createdAt: string;
  resourceVersion: string;
  destination?: IstioService;
  source?: IstioService;
  loadbalancing?: LoadBalancing;
  circuitBreaker?: CircuitBreaker;
}

// Virtual Service

export interface PortSelector {
  number: number;
  name: string;
}

export interface Destination {
  name: string;
  subset: string;
  port: PortSelector;
}

export interface HTTPMatchRequest {
  uri: StringMatch;
  scheme: StringMatch;
  method: StringMatch;
  authority: StringMatch;
  headers: { [key: string]: StringMatch };
  port: PortSelector;
  sourceLabels: { [key: string]: string };
  gateways: string[];
}

export interface HTTPRoute {
  match: HTTPMatchRequest[];
  route: DestinationWeight[];
  redirect: HTTPRedirect;
  rewrite: HTTPRewrite;
  websocketUpgrade: boolean;
  timeout: string;
  retries: HTTPRetry;
  mirror: Destination;
  corsPolicy: CorsPolicy;
  appendHeaders: { [key: string]: string };
}

export interface TCPRoute {
  match: L4MatchAttributes[];
  route: DestinationWeight[];
}

export interface VirtualService {
  name: string;
  createdAt: string;
  resourceVersion: string;
  hosts?: string[];
  gateways?: string[];
  http?: HTTPRoute[];
  tcp?: TCPRoute[];
}

// Destination Rule

export interface ConsistentHashLB {
  httpHeader: string;
  minimumRingSize: number;
}

export interface LoadBalancerSettings {
  simple: string;
  consistentHash: ConsistentHashLB;
}

export interface ConnectionPoolSettingsTCPSettings {
  maxConnections: number;
  connectTimeout: string;
}

export interface ConnectionPoolSettingsHTTPSettings {
  http1MaxPendingRequests: number;
  http2MaxRequests: number;
  maxRequestsPerConnection: number;
  maxRetries: number;
}

export interface ConnectionPoolSettings {
  tcp: ConnectionPoolSettingsTCPSettings;
  http: ConnectionPoolSettingsHTTPSettings;
}

export interface OutlierDetectionHTTPSettings {
  consecutiveErrors: number;
  interval: string;
  baseEjectionTime: string;
  maxEjectionPercent: number;
}

export interface OutlierDetection {
  http: OutlierDetectionHTTPSettings;
}

export interface TLSSettings {
  mode: string;
  clientCertificate: string;
  privateKey: string;
  caCertificates: string;
  subjectAltNames: string[];
  sni: string;
}

export interface TrafficPolicy {
  loadBalancer: LoadBalancerSettings;
  connectionPool: ConnectionPoolSettings;
  outlierDetection: OutlierDetection;
  tls: TLSSettings;
}

export interface Subset {
  name: string;
  labels: { [key: string]: string };
  trafficPolicy: TrafficPolicy;
}

export interface DestinationRule {
  name: string;
  createdAt: string;
  resourceVersion: string;
  host?: string;
  trafficPolicy?: TrafficPolicy;
  subsets?: Subset[];
}

// Istio Sidecar

export const hasIstioSidecar = (pods?: Pod[]) => {
  if (pods) {
    return pods.find(pod => pod.istioContainers != null) !== undefined;
  }
  return false;
};

export interface ServiceDetailsInfo {
  labels?: { [key: string]: string };
  type: string;
  name: string;
  createdAt: string;
  resourceVersion: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  istioSidecar: boolean;
  pods?: Pod[];
  deployments?: Deployment[];
  routeRules?: RouteRule[];
  destinationPolicies?: DestinationPolicy[];
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  dependencies?: { [key: string]: string[] };
  health?: Health;
}

// NamespaceValidations are grouped per 'namespace'
export type NamespaceValidations = { [key: string]: Validations };

// validations are grouped per 'objectType' first in the first map and 'name' in the inner map
export type Validations = { [key1: string]: { [key2: string]: ObjectValidation } };

export interface ObjectValidation {
  name: string;
  objectType: string;
  valid: boolean;
  checks?: ObjectCheck[];
}

export interface ObjectCheck {
  message: string;
  severity: string;
  path: string;
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

export const severityToIconName = (severity: string): string => {
  let iconName = IconSeverityMap.get(severity);
  if (!iconName) {
    iconName = 'ok';
  }

  return iconName;
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

export const validationToIconName = (object: ObjectValidation): string => {
  let severity = 'correct';

  if (object) {
    if (!object.valid) {
      severity = 'error';
    } else if (object.checks) {
      severity = 'warning';
    }
  }

  return severityToIconName(severity);
};

export const checkForPath = (object: ObjectValidation, path: string): ObjectCheck[] => {
  if (!object || !object.checks) {
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
