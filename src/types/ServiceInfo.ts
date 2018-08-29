import { ServiceHealth } from './Health';
import { PfColors } from '../components/Pf/PfColors';
import { Pod, Port, ObjectCheck, ObjectValidation } from './IstioObjects';

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
  labels?: { [key: string]: string };
  resourceVersion: string;
  createdAt: string;
}

// RouteRule type

export interface RouteRule {
  name: string;
  createdAt: string;
  resourceVersion: string;
  destination?: IstioService;
  precedence?: number;
  match?: MatchCondition;
  route?: DestinationWeightV1Alpha1[];
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

export interface TLSMatchAttributes {
  sniHosts: string[];
  destinationSubnet: string[];
  port: number;
  sourceLabels: { [key: string]: string };
  gateways: string[];
}

export interface MatchRequest {
  headers: { [key: string]: StringMatch };
}

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface DestinationWeightV1Alpha1 {
  labels: { [key: string]: string };
  weight?: number;
}

export interface DestinationWeight {
  destination: Destination;
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
  host: string;
  subset?: string;
  port?: PortSelector;
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
  match?: HTTPMatchRequest[];
  route?: DestinationWeight[];
  redirect?: HTTPRedirect;
  rewrite?: HTTPRewrite;
  websocketUpgrade?: boolean;
  timeout?: string;
  retries?: HTTPRetry;
  mirror?: Destination;
  corsPolicy?: CorsPolicy;
  appendHeaders?: { [key: string]: string };
}

export interface TCPRoute {
  match?: L4MatchAttributes[];
  route?: DestinationWeight[];
}

export interface TLSRoute {
  match?: TLSMatchAttributes[];
  route?: DestinationWeight[];
}

export interface VirtualService {
  name: string;
  createdAt: string;
  resourceVersion: string;
  hosts?: string[];
  gateways?: string[];
  http?: HTTPRoute[];
  tcp?: TCPRoute[];
  tls?: TLSRoute[];
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
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  dependencies?: { [key: string]: string[] };
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
