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

export interface Deployment {
  name: string;
  template_annotations?: any;
  labels?: Map<string, string>;
  created_at: string;
  resource_version: string;
  replicas: number;
  available_replicas: number;
  unavailable_replicas: number;
  autoscaler: Autoscaler;
}

export interface Autoscaler {
  name: string;
  labels?: Map<string, string>;
  min_replicas: number;
  max_replicas: number;
  target_cpu_utilization_percentage: number;
  current_replicas?: number;
  desired_replicas?: number;
}

// RouteRule type

export interface RouteRule {
  name: string;
  created_at: string;
  resource_version: string;
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
  appendHeaders?: Map<String, String>;
}

export interface IstioService {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: Map<String, String>;
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
  headers: Map<string, StringMatch>;
}

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

export interface DestinationWeight {
  labels: Map<string, string>;
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
  created_at: string;
  resource_version: string;
  destination: IstioService;
  source: IstioService;
  loadbalancing: LoadBalancing;
  circuitBreaker: CircuitBreaker;
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
  headers: Map<string, StringMatch>;
  port: PortSelector;
  sourceLabels: Map<string, string>;
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
  appendHeaders: Map<string, string>;
}

export interface TCPRoute {
  match: L4MatchAttributes[];
  route: DestinationWeight[];
}

export interface VirtualService {
  name: string;
  created_at: string;
  resource_version: string;
  hosts: string[];
  gateways: string[];
  http: HTTPRoute[];
  tcp: TCPRoute[];
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
  labels: Map<string, string>;
  trafficPolicy: TrafficPolicy;
}

export interface DestinationRule {
  name: string;
  created_at: string;
  resource_version: string;
  traffic_policy: TrafficPolicy;
  subsets: Subset[];
}

// Istio Sidecar

export const hasIstioSidecar = (deployments: Deployment[]) => {
  if (deployments && deployments.length > 0) {
    for (let i = 0; i < deployments.length; i++) {
      let annotations = deployments[i].template_annotations;
      if (annotations && annotations['sidecar.istio.io/status']) {
        return true;
      }
    }
  }
  return false;
};

export interface ServiceDetailsInfo {
  labels?: Map<string, string>;
  type: string;
  name: string;
  created_at: string;
  resource_version: string;
  ip: string;
  ports?: Port[];
  endpoints?: Endpoints[];
  istio_sidecar: boolean;
  deployments?: Deployment[];
  routeRules?: RouteRule[];
  destinationPolicies?: DestinationPolicy[];
  virtualServices?: VirtualService[];
  destinationRules?: DestinationRule[];
  dependencies?: Map<string, string[]>;
  health?: Health;
}

export interface EditorLink {
  editorLink: string;
}
