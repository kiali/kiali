import { Namespace } from './Namespace';
import { ServicePort } from './ServiceInfo';
import { ProxyStatus } from './Health';
import { TimeInSeconds } from './Common';
import { KIALI_RELATED_LABEL, KIALI_WIZARD_LABEL } from 'components/IstioWizards/WizardActions';
import { PFColorVal } from 'components/Pf/PfColors';

// Common types

export interface HelpMessage {
  message: string;
  objectField: string;
}

export interface K8sInitializer {
  name?: string;
}

export interface K8sStatus {
  message?: string;
  reason?: string;
  status?: string;
}

export interface K8sInitializers {
  pending?: K8sInitializer[];
  result?: K8sStatus;
}

export interface K8sMetadata {
  annotations?: { [key: string]: string };
  clusterName?: string;
  creationTimestamp?: string;
  deletionGracePeriodSeconds?: number;
  deletionTimestamp?: string;
  finalizers?: string[];
  generateName?: string;
  generation?: number;
  initializers?: K8sInitializers[];
  labels?: { [key: string]: string };
  name: string;
  namespace?: string;
  ownerReferences?: K8sOwnerReference[];
  resourceVersion?: string;
  selfLink?: string;
  uid?: string;
}

export interface IstioObject {
  apiVersion?: string;
  kind?: string;
  metadata: K8sMetadata;
  status?: IstioStatus;
}

export interface IstioStatus {
  conditions?: StatusCondition[];
  validationMessages?: ValidationMessage[];
}

export interface ValidationMessage {
  description?: string;
  documentationUrl: string;
  level?: string;
  type: ValidationMessageType;
}

export interface StatusCondition {
  message: string;
  status: boolean;
  type: string;
}

export interface ValidationMessageType {
  code: string;
}

// validations are grouped per 'objectType' first in the first map and 'name' in the inner map
export type Validations = { [key1: string]: { [key2: string]: ObjectValidation } };

export enum ValidationTypes {
  Error = 'error',
  Warning = 'warning',
  Correct = 'correct',
  Info = 'info'
}

export const IstioLevelToSeverity = {
  ERROR: ValidationTypes.Error,
  INFO: ValidationTypes.Info,
  UNKNOWN: ValidationTypes.Info,
  WARNING: ValidationTypes.Warning
};

export interface ObjectValidation {
  checks: ObjectCheck[];
  name: string;
  objectType: string;
  references?: ObjectReference[];
  valid: boolean;
}

export interface ObjectCheck {
  code?: string;
  message: string;
  path: string;
  severity: ValidationTypes;
}

export interface ObjectReference {
  name: string;
  namespace: string;
  objectType: string;
}

export interface PodReference {
  kind: string;
  name: string;
}

export interface References {
  objectReferences: ObjectReference[];
  serviceReferences: ServiceReference[];
  workloadReferences: WorkloadReference[];
}

export interface ServiceReference {
  name: string;
  namespace: string;
}

export interface ValidationStatus {
  cluster?: string;
  errors: number;
  namespace: string;
  objectCount?: number;
  warnings: number;
}

export interface WorkloadReference {
  name: string;
  namespace: string;
}

export interface ContainerInfo {
  image: string;
  isAmbient: boolean;
  isProxy: boolean;
  isReady: boolean;
  name: string;
}

// 1.6
export interface Port {
  name: string;
  number: number;
  protocol: string;
  targetPort?: number;
}

export interface Pod {
  annotations?: { [key: string]: string };
  appLabel: boolean;
  containers?: ContainerInfo[];
  createdAt: string;
  createdBy: PodReference[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
  labels?: { [key: string]: string };
  name: string;
  proxyStatus?: ProxyStatus;
  serviceAccountName: string;
  status: string;
  statusMessage?: string;
  statusReason?: string;
  versionLabel: boolean;
}

// models Engarde Istio proxy AccessLog
export type AccessLog = {
  // Authority is the request authority header %REQ(:AUTHORITY)%
  authority: string;
  // BytesReceived in response to the request %BYTES_RECEIVED%
  bytes_received: string;
  // BytesSent as part of the request body %BYTES_SENT%
  bytes_sent: string;
  // DownstreamLocal is the local address of the downstream connection %DOWNSTREAM_LOCAL_ADDRESS%
  downstream_local: string;
  // DownstreamRemote is the remote address of the downstream connection %DOWNSTREAM_REMOTE_ADDRESS%
  downstream_remote: string;
  // Duration of the request %DURATION%
  duration: string;
  // ForwardedFor is the X-Forwarded-For header value %REQ(FORWARDED-FOR)%
  forwarded_for: string;
  // Method is the HTTP method %REQ(:METHOD)%
  method: string;
  // Protocol can either be HTTP or TCP %PROTOCOL%
  protocol: string;
  // RequestId is the envoy generated X-REQUEST-ID header "%REQ(X-REQUEST-ID)%"
  request_id: string;
  // RequestedServer is the String value set on ssl connection socket for Server Name Indication (SNI) %REQUESTED_SERVER_NAME%
  requested_server: string;
  // ResponseFlags provide any additional details about the response or connection, if any. %RESPONSE_FLAGS%
  response_flags: string;
  // RouteName is the name of the VirtualService route which matched this request %ROUTE_NAME%
  route_name: string;
  // StatusCode is the response status code %RESPONSE_CODE%
  status_code: string;
  // TcpServiceTime is the time the tcp request took
  tcp_service_time: string;
  // Timestamp is the Start Time %START_TIME%
  timestamp: string;
  // UpstreamCluster is the upstream envoy cluster being reached %UPSTREAM_CLUSTER%
  upstream_cluster: string;
  // UpstreamFailureReason is the upstream transport failure reason %UPSTREAM_TRANSPORT_FAILURE_REASON%
  upstream_failure_reason: string;
  // UpstreamLocal is the local address of the upstream connection %UPSTREAM_LOCAL_ADDRESS%
  upstream_local: string;
  // UpstreamService is the upstream host the request is intended for %UPSTREAM_HOST%
  upstream_service: string;
  // UpstreamServiceTime is the time taken to reach target host %RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)%
  upstream_service_time: string;
  // UriParam is the params field of the request path
  uri_param: string;
  // UriPath is the base request path
  uri_path: string;
  // UserAgent is the request User Agent field %REQ(USER-AGENT)%"
  user_agent: string;
  // The following fields are unused/ignored
  //
  // MixerStatus is the dynamic metadata information for the mixer status %DYNAMIC_METADATA(mixer:status)%
  // mixer_status: string;
  // OriginalMessage is the original raw log line.
  // original_message: string;
  // ParseError provides a string value if a parse error occured.
  // parse_error: string;
};

export type LogEntry = {
  accessLog?: AccessLog;
  color?: PFColorVal;
  message: string;
  severity: string;
  timestamp: string;
  timestampUnix: TimeInSeconds;
};

export interface PodLogs {
  entries: LogEntry[];
  linesTruncated?: boolean;
}

export enum LogType {
  APP = 'app',
  PROXY = 'proxy',
  ZTUNNEL = 'ztunnel',
  WAYPOINT = 'waypoint'
}

export interface PodLogsQuery {
  container?: string;
  duration?: string;
  logType?: LogType;
  maxLines?: number;
  sinceTime?: number;
}

export interface LogLevelQuery {
  level: string;
}

export interface EnvoyProxyDump {
  bootstrap?: BootstrapSummary;
  clusters?: ClusterSummary[];
  configDump?: EnvoyConfigDump;
  listeners?: ListenerSummary[];
  routes?: RouteSummary[];
}

export interface EnvoyConfigDump {
  configs: any[];
}

export type EnvoySummary = ClusterSummary | RouteSummary | ListenerSummary;

export interface ClusterSummary {
  destination_rule: string;
  direction: string;
  port: number;
  service_fqdn: Host;
  subset: string;
  type: string;
}

export interface ListenerSummary {
  address: string;
  destination: string;
  match: string;
  port: number;
}

export interface RouteSummary {
  domains: Host;
  match: string;
  name: string;
  virtual_service: string;
}

export interface BootstrapSummary {
  bootstrap: any;
}

export interface Service {
  createdAt: string;
  ip: string;
  labels?: { [key: string]: string };
  name: string;
  namespace: Namespace;
  ports?: ServicePort[];
  resourceVersion: string;
  type: string;
}

export interface Host {
  cluster?: string;
  namespace: string;
  service: string;
}

export interface IstioService {
  domain?: string;
  labels?: { [key: string]: string };
  name?: string;
  namespace?: string;
  service?: string;
}

// 1.6
export interface L4MatchAttributes {
  destinationSubnets?: string[];
  gateways?: string[];
  port?: number;
  sourceLabels?: { [key: string]: string };
  sourceName?: string;
}

// 1.6
export interface TLSMatchAttributes {
  destinationSubnets?: string[];
  gateways?: string[];
  port?: number;
  sniHosts: string[];
  sourceLabels?: { [key: string]: string };
  sourceName?: string;
}

// 1.6
export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
}

// 1.6
export interface HeaderOperations {
  add?: { [key: string]: string };
  remove?: string[];
  set?: { [key: string]: string };
}

// 1.6
export interface Headers {
  request?: HeaderOperations;
  response?: HeaderOperations;
}

// 1.6
export interface HTTPRouteDestination {
  destination: Destination;
  headers?: Headers;
  weight?: number;
}

// 1.6
export interface RouteDestination {
  destination: Destination;
  weight?: number;
}

// 1.6
export interface HTTPRedirect {
  authority?: string;
  redirectCode?: number;
  uri?: string;
}

// 1.6
export interface Delegate {
  name?: string;
  namespace?: string;
}

// 1.6
export interface HTTPRewrite {
  authority?: string;
  uri?: string;
}

// 1.6
export interface HTTPRetry {
  attempts: number;
  perTryTimeout?: string;
  retryOn?: string;
  retryRemoteLocalities?: boolean;
}

// 1.6
export interface HTTPFaultInjection {
  abort?: Abort;
  delay?: Delay;
}

// 1.6
export interface Percent {
  value: number;
}

// 1.6
export interface Delay {
  fixedDelay: string;
  percentage?: Percent;
}

// 1.6
export interface Abort {
  httpStatus: number;
  percentage?: Percent;
}

// 1.6
export interface CorsPolicy {
  allowCredentials?: string;
  allowHeaders?: string[];
  allowMethods?: string[];
  allowOrigin?: StringMatch[];
  exposeHeaders?: string[];
  maxAge?: string;
}

// Destination Rule

export interface HTTPCookie {
  name: string;
  path?: string;
  ttl: string;
}

// 1.6
export interface ConsistentHashLB {
  httpCookie?: HTTPCookie | null;
  httpHeaderName?: string | null;
  httpQueryParameterName?: string | null;
  minimumRingSize?: number;
  useSourceIp?: boolean | null;
}

// 1.6
export interface Distribute {
  from?: string;
  to?: { [key: string]: number };
}

// 1.6
export interface Failover {
  from?: string;
  to?: string;
}

// 1.6
export interface LocalityLoadBalancerSetting {
  distribute?: Distribute[];
  enabled?: boolean;
  failover?: Failover[];
}

// 1.6
export interface LoadBalancerSettings {
  consistentHash?: ConsistentHashLB | null;
  localityLbSetting?: LocalityLoadBalancerSetting | null;
  simple?: string | null;
}

// 1.6
export interface TcpKeepalive {
  interval?: string;
  probes?: number;
  time?: string;
}

// 1.6
export interface ConnectionPoolSettingsTCPSettings {
  connectTimeout?: string;
  maxConnections?: number;
  tcpKeepalive?: TcpKeepalive;
}

// 1.6
export interface ConnectionPoolSettingsHTTPSettings {
  h2UpgradePolicy?: string;
  http1MaxPendingRequests?: number;
  http2MaxRequests?: number;
  idleTimeout?: string;
  maxRequestsPerConnection?: number;
  maxRetries?: number;
}

// 1.6
export interface ConnectionPoolSettings {
  http?: ConnectionPoolSettingsHTTPSettings;
  tcp?: ConnectionPoolSettingsTCPSettings;
}

// 1.6
export interface OutlierDetection {
  baseEjectionTime?: string;
  consecutive5xxErrors?: number;
  consecutiveErrors?: number;
  interval?: string;
  maxEjectionPercent?: number;
  minHealthPercent?: number;
}

// 1.6
export interface ClientTLSSettings {
  caCertificates?: string | null;
  clientCertificate?: string | null;
  mode: string;
  privateKey?: string | null;
  sni?: string | null;
  subjectAltNames?: string[] | null;
}

// 1.6
export interface PortTrafficPolicy {
  connectionPool?: ConnectionPoolSettings;
  loadBalancer?: LoadBalancerSettings;
  outlierDetection?: OutlierDetection;
  port?: PortSelector;
  tls?: ClientTLSSettings;
}

// 1.6
export interface TrafficPolicy {
  connectionPool?: ConnectionPoolSettings;
  loadBalancer?: LoadBalancerSettings | null;
  outlierDetection?: OutlierDetection;
  portLevelSettings?: PortTrafficPolicy[];
  tls?: ClientTLSSettings | null;
}

// 1.6
export interface Subset {
  labels?: { [key: string]: string };
  name: string;
  trafficPolicy?: TrafficPolicy;
}

// 1.6
export interface DestinationRuleSpec {
  exportTo?: string[];
  host?: string;
  subsets?: Subset[];
  trafficPolicy?: TrafficPolicy | null;
}

// 1.6
export interface DestinationRule extends IstioObject {
  spec: DestinationRuleSpec;
}

export class DestinationRuleC implements DestinationRule {
  metadata: K8sMetadata = { name: '' };
  spec: DestinationRuleSpec = {};

  constructor(dr: DestinationRule) {
    Object.assign(this, dr);
  }

  static fromDrArray(drs: DestinationRule[]): DestinationRuleC[] {
    return drs.map(item => new DestinationRuleC(item));
  }

  hasPeerAuthentication(): string {
    if (
      !!this.metadata &&
      !!this.metadata.annotations &&
      this.metadata.annotations[KIALI_RELATED_LABEL] !== undefined
    ) {
      const anno = this.metadata.annotations[KIALI_RELATED_LABEL];
      const parts = anno.split('/');
      if (parts.length > 1) {
        return parts[1];
      }
    }
    return '';
  }
}

// Virtual Service

// 1.6
export interface PortSelector {
  name?: string;
  number: number;
}

// 1.6
export interface Destination {
  host: string;
  port?: PortSelector;
  subset?: string;
}

// 1.6
export interface HTTPMatchRequest {
  authority?: StringMatch;
  gateways?: string[];
  headers?: { [key: string]: StringMatch };
  ignoreUriCase?: boolean;
  method?: StringMatch;
  name?: string;
  port?: PortSelector;
  queryParams?: { [key: string]: StringMatch };
  scheme?: StringMatch;
  sourceLabels?: { [key: string]: string };
  sourceNamespace?: string;
  uri?: StringMatch;
  withoutHeaders?: { [key: string]: StringMatch };
}

// 1.6
export interface HTTPRoute {
  corsPolicy?: CorsPolicy;
  delegate?: Delegate;
  fault?: HTTPFaultInjection;
  headers?: Headers;
  match?: HTTPMatchRequest[];
  mirror?: Destination;
  mirrorPercentage?: Percent;
  name?: string;
  redirect?: HTTPRedirect;
  retries?: HTTPRetry;
  rewrite?: HTTPRewrite;
  route?: HTTPRouteDestination[];
  timeout?: string;
}

// 1.6
export interface TCPRoute {
  match?: L4MatchAttributes[];
  route?: RouteDestination[];
}

// 1.6
export interface TLSRoute {
  match?: TLSMatchAttributes[];
  route?: RouteDestination[];
}

// 1.6
export interface VirtualServiceSpec {
  exportTo?: string[] | null;
  gateways?: string[] | null;
  hosts?: string[];
  http?: HTTPRoute[];
  tcp?: TCPRoute[];
  tls?: TLSRoute[];
}

// 1.6
export interface VirtualService extends IstioObject {
  spec: VirtualServiceSpec;
}

export const getWizardUpdateLabel = (
  vs: VirtualService | VirtualService[] | null,
  k8sr: K8sHTTPRoute | K8sHTTPRoute[] | null
): string => {
  let label = getVirtualServiceUpdateLabel(vs);

  if (label === '') {
    label = getK8sHTTPRouteUpdateLabel(k8sr);
  }

  return label;
};

export const getVirtualServiceUpdateLabel = (vs: VirtualService | VirtualService[] | null): string => {
  if (!vs) {
    return '';
  }

  let virtualService: VirtualService | null = null;

  if ('length' in vs) {
    if (vs.length === 1) {
      virtualService = vs[0];
    }
  } else {
    virtualService = vs;
  }

  if (virtualService && virtualService.metadata.labels && virtualService.metadata.labels[KIALI_WIZARD_LABEL]) {
    return virtualService.metadata.labels[KIALI_WIZARD_LABEL];
  } else {
    return '';
  }
};

export const getK8sHTTPRouteUpdateLabel = (k8sr: K8sHTTPRoute | K8sHTTPRoute[] | null): string => {
  if (!k8sr) {
    return '';
  }

  let k8sHTTPRoute: K8sHTTPRoute | null = null;

  if ('length' in k8sr) {
    if (k8sr.length === 1) {
      k8sHTTPRoute = k8sr[0];
    }
  } else {
    k8sHTTPRoute = k8sr;
  }

  if (k8sHTTPRoute && k8sHTTPRoute.metadata.labels && k8sHTTPRoute.metadata.labels[KIALI_WIZARD_LABEL]) {
    return k8sHTTPRoute.metadata.labels[KIALI_WIZARD_LABEL];
  } else {
    return '';
  }
};

export interface K8sOwnerReference {
  apiVersion: string;
  blockOwnerDeletion?: boolean;
  controller?: boolean;
  kind: string;
  name: string;
  uid: string;
}

// 1.6
export interface GatewaySpec {
  selector?: { [key: string]: string };
  servers?: Server[];
}

// 1.6
export interface Gateway extends IstioObject {
  spec: GatewaySpec;
}

export const getGatewaysAsList = (gws: Gateway[]): string[] => {
  return gws.map(gateway => `${gateway.metadata.namespace}/${gateway.metadata.name}`).sort();
};

export const filterAutogeneratedGateways = (gws: Gateway[]): Gateway[] => {
  return gws.filter(gateway => !gateway.metadata.name.includes('autogenerated-k8s'));
};

export const getK8sGatewaysAsList = (k8sGws: K8sGateway[]): string[] => {
  if (k8sGws) {
    return k8sGws.map(gateway => `${gateway.metadata.namespace}/${gateway.metadata.name}`).sort();
  } else {
    return [];
  }
};

// K8s Gateway API https://istio.io/latest/docs/tasks/traffic-management/ingress/gateway-api/

export interface Listener {
  allowedRoutes: AllowedRoutes;
  hostname: string;
  name: string;
  port: number;
  protocol: string;
  tls?: K8sGatewayTLS | null;
}

export interface Address {
  type: string;
  value: string;
}

export interface AllowedRoutes {
  namespaces: FromNamespaces;
}

export interface LabelSelector {
  matchLabels: { [key: string]: string };
}

export interface FromNamespaces {
  from: string;
  selector?: LabelSelector;
}

export interface ParentRef {
  name: string;
  namespace: string;
}

// k8s gateway objects
export interface K8sGateway extends IstioObject {
  spec: K8sGatewaySpec;
}

export interface K8sGRPCRoute extends IstioObject {
  spec: K8sGRPCRouteSpec;
}

export interface K8sHTTPRoute extends IstioObject {
  spec: K8sHTTPRouteSpec;
}

export interface K8sReferenceGrant extends IstioObject {
  spec: K8sReferenceGrantSpec;
}

export interface K8sTCPRoute extends IstioObject {
  spec: K8sTCPRouteSpec;
}

export interface K8sTLSRoute extends IstioObject {
  spec: K8sTLSRouteSpec;
}

// spec objects used by k8s gateway objects
export interface K8sCommonRouteSpec {
  parentRefs?: ParentRef[];
}

export interface K8sGatewaySpec {
  addresses?: Address[];
  gatewayClassName: string;
  listeners?: Listener[];
}

export interface K8sGatewayTLS {
  certificateRefs: K8sGatewayTLSCertRef[];
}

export interface K8sGatewayTLSCertRef {
  group?: string;
  kind: string;
  name: string;
  namespace?: string;
}

export interface K8sGRPCRouteSpec extends K8sCommonRouteSpec {
  hostnames?: string[];
  rules?: K8sGRPCRouteRule[];
}

export interface K8sHTTPRouteSpec extends K8sCommonRouteSpec {
  hostnames?: string[];
  rules?: K8sHTTPRouteRule[];
}

export interface K8sReferenceGrantSpec {
  from?: K8sReferenceRule[];
  to?: K8sReferenceRule[];
}

export interface K8sTCPRouteSpec extends K8sCommonRouteSpec {
  rules?: K8sTCPRouteRule[];
}

export interface K8sTLSRouteSpec extends K8sCommonRouteSpec {
  hostnames?: string[];
  rules?: K8sTLSRouteRule[];
}

// rest of attributes used by k8s gateway objects
export interface K8sGRPCRouteRule {
  backendRefs?: K8sRouteBackendRef[];
  matches?: K8sGRPCRouteMatch[];
}

export interface K8sHTTPRouteRule {
  backendRefs?: K8sRouteBackendRef[];
  filters?: K8sHTTPRouteFilter[];
  matches?: K8sHTTPRouteMatch[];
}

export interface K8sReferenceRule {
  group: string;
  kind: string;
  namespace?: string;
}

export interface K8sTCPRouteRule {
  backendRefs?: K8sRouteBackendRef[];
}

export interface K8sTLSRouteRule {
  backendRefs?: K8sRouteBackendRef[];
}

export interface K8sGRPCHeaderMatch {
  name?: string;
  type?: string;
  value?: string;
}

export interface K8sGRPCMethodMatch {
  method?: string;
  service?: string;
  type?: string;
}

export interface K8sGRPCRouteMatch {
  headers?: K8sGRPCHeaderMatch[];
  method?: K8sGRPCMethodMatch;
}

export interface K8sHTTPMatch {
  name?: string;
  type?: string;
  value?: string;
}

export interface K8sHTTPRouteFilter {
  requestHeaderModifier?: K8sHTTPHeaderFilter;
  requestMirror?: K8sHTTPRequestMirrorFilter;
  requestRedirect?: K8sHTTPRouteRequestRedirect;
  type?: string;
}

export interface K8sHTTPRouteMatch {
  headers?: K8sHTTPMatch[];
  method?: string;
  path?: K8sHTTPMatch;
  queryParams?: K8sHTTPMatch[];
}

export interface K8sHTTPRouteRequestRedirect {
  hostname?: string;
  port?: number;
  scheme?: string;
  statusCode?: number;
}

export interface K8sHTTPHeaderFilter {
  add?: HTTPHeader[];
  remove?: string[];
  set?: HTTPHeader[];
}

export interface K8sHTTPRequestMirrorFilter {
  backendRef?: K8sRouteBackendRef;
}

export interface K8sRouteBackendRef {
  filters?: K8sHTTPRouteFilter[];
  name: string;
  namespace?: string;
  port?: number;
  weight?: number;
}

// Sidecar resource https://preliminary.istio.io/docs/reference/config/networking/v1alpha3/sidecar

// 1.6
export enum CaptureMode {
  DEFAULT = 'DEFAULT',
  IPTABLES = 'IPTABLES',
  NONE = 'NONE'
}

// 1.6
export interface IstioEgressListener {
  bind?: string;
  captureMode?: CaptureMode;
  hosts: string[];
  localhostServerTls?: ServerTLSSettings;
  port?: Port;
}

// 1.6
export interface IstioIngressListener {
  bind?: string;
  captureMode?: CaptureMode;
  defaultEndpoint: string;
  localhostClientTls?: ClientTLSSettings;
  port: Port;
}

// 1.6
export interface WorkloadSelector {
  labels: { [key: string]: string };
}

// 1.6
export interface OutboundTrafficPolicy {
  mode?: string;
}

// 1.6
export interface Localhost {
  clientTls?: ClientTLSSettings;
  serverTls?: ServerTLSSettings;
}

// 1.6
export interface SidecarSpec {
  egress?: IstioEgressListener[];
  ingress?: IstioIngressListener[];
  localhost?: Localhost;
  outboundTrafficPolicy?: OutboundTrafficPolicy;
  workloadSelector?: WorkloadSelector;
}

// 1.6
export interface Sidecar extends IstioObject {
  spec: SidecarSpec;
}

// 1.6
export interface Server {
  hosts: string[];
  port: ServerPort;
  tls?: ServerTLSSettings;
}

export interface ServerForm {
  hosts: string[];
  name: string;
  number: string;
  protocol: string;
  tlsCaCertificate: string;
  tlsMode: string;
  tlsPrivateKey: string;
  tlsServerCertificate: string;
}

// 1.6
export interface ServerPort {
  name: string;
  number: number;
  protocol: string;
}

// 1.6
export interface ServerTLSSettings {
  caCertificates?: string;
  cipherSuites?: string[];
  credentialName?: string;
  httpsRedirect?: boolean;
  maxProtocolVersion?: string;
  minProtocolVersion?: string;
  mode?: string;
  privateKey?: string;
  serverCertificate?: string;
  subjectAltNames?: string[];
  verifyCertificateHash?: string[];
  verifyCertificateSpki?: string[];
}

// 1.6
export interface ServiceEntrySpec {
  addresses?: string[];
  endpoints?: WorkloadEntrySpec[];
  exportTo?: string[];
  hosts?: string[];
  location?: string;
  ports?: Port[];
  resolution?: string;
  subjectAltNames?: string[];
  workloadSelector?: WorkloadSelector;
}

// 1.6
export interface ServiceEntry extends IstioObject {
  spec: ServiceEntrySpec;
}

export interface WasmPlugin extends IstioObject {
  spec: WasmPluginSpec;
}

export interface WasmPluginSpec extends IstioObject {
  pluginName: string;
  url: string;
  workloadSelector?: WorkloadSelector;
}

export interface Telemetry extends IstioObject {
  spec: TelemetrySpec;
}

export interface TelemetrySpec extends IstioObject {
  workloadSelector?: WorkloadSelector;
}

export interface Endpoint {
  address: string;
  labels: { [key: string]: string };
  ports: { [key: string]: number };
}

export interface Match {
  clause: { [attributeName: string]: { [matchType: string]: string } };
}

export interface TargetSelector {
  name: string;
  ports?: PortSelector[];
}

export enum MutualTlsMode {
  PERMISSIVE = 'PERMISSIVE',
  STRICT = 'STRICT'
}

export interface MutualTls {
  allowTls: boolean;
  mode: MutualTlsMode;
}

export interface PeerAuthenticationMethod {
  mtls: MutualTls;
}

export interface Jwt {
  audiences: string[];
  issuer: string;
  jwksUri?: string;
  jwtHeaders: string[];
  jwtParams: string[];
}

export interface OriginAuthenticationMethod {
  jwt: Jwt;
}

export enum PrincipalBinding {
  USE_ORIGIN = 'USE_ORIGIN',
  USE_PEER = 'USE_PEER'
}

export interface AuthorizationPolicy extends IstioObject {
  spec: AuthorizationPolicySpec;
}

export interface AuthorizationPolicyWorkloadSelector {
  matchLabels: { [key: string]: string };
}

export interface AuthorizationPolicySpec {
  action?: string;
  rules?: AuthorizationPolicyRule[];
  selector?: AuthorizationPolicyWorkloadSelector;
}

export interface AuthorizationPolicyRule {
  from?: RuleFrom[];
  to?: RuleTo[];
  when?: Condition[];
}

export interface RuleFrom {
  source: Source;
}

export interface Source {
  ipBlocks?: string[];
  namespaces?: string[];
  notIpBlocks?: string[];
  notNamespaces?: string[];
  notPrincipals?: string[];
  notRequestPrincipals?: string[];
  principals?: string[];
  requestPrincipals?: string[];
}

export interface RuleTo {
  operation: Operation;
}

export interface Operation {
  hosts?: string[];
  methods?: string[];
  notHosts?: string[];
  notMethods?: string[];
  notPaths?: string[];
  notPorts?: string[];
  paths?: string[];
  ports?: string[];
}

export interface Condition {
  key: string;
  notValues?: string[];
  values?: string[];
}

export interface PeerAuthentication extends IstioObject {
  spec: PeerAuthenticationSpec;
}

export interface PeerAuthenticationSpec {
  mtls?: PeerAuthenticationMutualTls;
  portLevelMtls?: { [key: number]: PeerAuthenticationMutualTls };
  selector?: PeerAuthenticationWorkloadSelector;
}

export interface PeerAuthenticationWorkloadSelector {
  matchLabels: { [key: string]: string };
}

export interface PeerAuthenticationMutualTls {
  mode: PeerAuthenticationMutualTLSMode;
}

export enum PeerAuthenticationMutualTLSMode {
  DISABLE = 'DISABLE',
  PERMISSIVE = 'PERMISSIVE',
  STRICT = 'STRICT',
  UNSET = 'UNSET'
}

// 1.6
export interface WorkloadEntry extends IstioObject {
  spec: WorkloadEntrySpec;
}

export interface WorkloadEntrySpec {
  address: string;
  labels?: { [key: string]: string };
  locality?: string;
  network?: string;
  ports?: { [key: string]: number };
  serviceAccount?: string;
  weight?: number;
}

export interface WorkloadGroup extends IstioObject {
  spec: WorkloadGroupSpec;
}

export interface WorkloadGroupSpec {
  // Note that WorkloadGroup has a metadata section inside Spec
  metadata?: K8sMetadata;
  probe?: ReadinessProbe;
  template: WorkloadEntrySpec;
}

export interface ReadinessProbe {
  exec?: ExecHealthCheckConfig;
  failureThreshold?: number;
  httpGet?: HTTPHealthCheckConfig;
  initialDelaySeconds?: number;
  periodSeconds?: number;
  successThreshold?: number;
  tcpSocket?: TCPHealthCheckConfig;
  timeoutSeconds?: number;
}

export interface HTTPHealthCheckConfig {
  host?: string;
  httpHeaders?: HTTPHeader[];
  path?: string;
  port: number;
  scheme?: string;
}

export interface HTTPHeader {
  name?: string;
  value?: string;
}

export interface TCPHealthCheckConfig {
  host?: string;
  port: number;
}

export interface ExecHealthCheckConfig {
  command?: string[];
}

export interface WorkloadMatchSelector {
  matchLabels: { [key: string]: string };
}

export interface JWTHeader {
  name: string;
  prefix?: string;
}

export interface JWTRule {
  audiences?: string[];
  forwardOriginalToken?: boolean;
  fromHeaders?: JWTHeader[];
  fromParams?: string[];
  issuer?: string;
  jwks?: string;
  jwksUri?: string;
  outputPayloadToHeader?: string;
}

// 1.6
export interface RequestAuthentication extends IstioObject {
  spec: RequestAuthenticationSpec;
}

// 1.6
export interface RequestAuthenticationSpec {
  jwtRules: JWTRule[];
  selector?: WorkloadMatchSelector;
}

export interface ProxyMatch {
  metadata?: { [key: string]: string };
  proxyVersion?: string;
}

export interface SubFilterMatch {
  name?: string;
}

export interface FilterMatch {
  name?: string;
  subFilter?: SubFilterMatch;
}

export interface FilterChainMatch {
  applicationProtocols?: string;
  filter?: FilterMatch;
  name?: string;
  sni?: string;
  transportProtocol?: string;
}

export interface ListenerMatch {
  filterChain?: FilterChainMatch;
  portNumber?: number;
}

export interface RouteMatch {
  action?: string;
  name?: string;
}

export interface VirtualHostMatch {
  name?: string;
  route?: RouteMatch;
}

export interface RouteConfigurationMatch {
  gateway?: string;
  name?: string;
  portName?: string;
  portNumber?: number;
  vhost?: VirtualHostMatch;
}

export interface ClusterMatch {
  name?: string;
  portNumber?: number;
  service?: string;
  subset?: string;
}

export interface EnvoyConfigObjectMatch {
  cluster?: ClusterMatch;
  context?: string;
  listener?: ListenerMatch;
  proxy?: ProxyMatch;
  routeConfiguration?: RouteConfigurationMatch;
}

export interface Patch {
  operation?: string;
  value?: any;
}

export interface EnvoyConfigObjectPatch {
  applyTo?: string;
  match?: EnvoyConfigObjectMatch;
  patch?: Patch;
}

export interface EnvoyFilterSpec {
  configPatches: EnvoyConfigObjectPatch[];
  workloadSelector?: WorkloadSelector;
}

export interface EnvoyFilter extends IstioObject {
  spec: EnvoyFilterSpec;
}

export interface AttributeInfo {
  description?: string;
  valueType: string;
}

export interface APIKey {
  cookie?: string;
  header?: string;
  query?: string;
}

export interface CanaryUpgradeStatus {
  currentVersion: string;
  migratedNamespaces: string[];
  pendingNamespaces: string[];
  upgradeVersion: string;
}

export const MAX_PORT = 65535;
export const MIN_PORT = 0;
