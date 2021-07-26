import Namespace from './Namespace';
import { ResourcePermissions } from './Permissions';
import { ServicePort } from './ServiceInfo';
import { ProxyStatus } from './Health';
import { TimeInSeconds } from './Common';
import { PFColorVal } from 'components/Pf/PfColors';

// Common types

export interface K8sInitializer {
  name?: string;
}

export interface K8sStatus {
  status?: string;
  message?: string;
  reason?: string;
}

export interface K8sInitializers {
  pending?: K8sInitializer[];
  result?: K8sStatus;
}

export interface K8sMetadata {
  name: string;
  generateName?: string;
  namespace?: string;
  selfLink?: string;
  uid?: string;
  resourceVersion?: string;
  generation?: string;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  deletionGracePeriodSeconds?: string;
  labels?: { [key: string]: string };
  annotations?: { [key: string]: string };
  ownerReferences?: K8sOwnerReference[];
  initializers?: K8sInitializers[];
  finalizers?: string[];
  clusterName?: string;
}

export interface IstioObject {
  kind?: string;
  apiVersion?: string;
  metadata: K8sMetadata;
  status?: IstioStatus;
}

export interface IstioStatus {
  validationMessages?: ValidationMessage[];
  conditions?: any[];
}

export interface ValidationMessage {
  description?: string;
  documentation_url: string;
  level?: number;
  type: ValidationMessageType;
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
  0: ValidationTypes.Info,
  3: ValidationTypes.Error,
  8: ValidationTypes.Warning,
  12: ValidationTypes.Info
};

export interface ObjectValidation {
  name: string;
  objectType: string;
  valid: boolean;
  checks: ObjectCheck[];
  references?: ObjectReference[];
}

export interface ObjectCheck {
  code?: string;
  message: string;
  severity: ValidationTypes;
  path: string;
}

export interface ObjectReference {
  objectType: string;
  name: string;
  namespace: string;
}

export interface Reference {
  name: string;
  kind: string;
}

export interface ValidationStatus {
  errors: number;
  objectCount?: number;
  warnings: number;
}

export interface ContainerInfo {
  name: string;
  image: string;
  isProxy: boolean;
  isReady: boolean;
}

// 1.6
export interface Port {
  number: number;
  protocol: string;
  name: string;
  targetPort?: number;
}

export interface Pod {
  name: string;
  labels?: { [key: string]: string };
  createdAt: string;
  createdBy: Reference[];
  containers?: ContainerInfo[];
  istioContainers?: ContainerInfo[];
  istioInitContainers?: ContainerInfo[];
  status: string;
  statusMessage?: string;
  statusReason?: string;
  appLabel: boolean;
  versionLabel: boolean;
  proxyStatus?: ProxyStatus;
}

// models Engarde Istio proxy AccessLog
export type AccessLog = {
  // Authority is the request authority header %REQ(:AUTHORITY)%
  authority: string;
  // BytesReceived in response to the request %BYTES_RECEIVED%
  bytes_received: string;
  // BytesSent as part of the request body %BYTES_SENT%
  bytes_sent: string;
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
  // ResponseFlags provide any additional details about the response or connection, if any. %RESPONSE_FLAGS%
  response_flags: string;
  // StatusCode is the response status code %RESPONSE_CODE%
  status_code: string;
  // TcpServiceTime is the time the tcp request took
  tcp_service_time: string;
  // Timestamp is the Start Time %START_TIME%
  timestamp: string;
  // UpstreamService is the upstream host the request is intended for %UPSTREAM_HOST%
  upstream_service: string;
  // UpstreamServiceTime is the time taken to reach target host %RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)%
  upstream_service_time: string;
  // UpstreamCluster is the upstream envoy cluster being reached %UPSTREAM_CLUSTER%
  upstream_cluster: string;
  // UpstreamLocal is the local address of the upstream connection %UPSTREAM_LOCAL_ADDRESS%
  upstream_local: string;
  // DownstreamLocal is the local address of the downstream connection %DOWNSTREAM_LOCAL_ADDRESS%
  downstream_local: string;
  // DownstreamRemote is the remote address of the downstream connection %DOWNSTREAM_REMOTE_ADDRESS%
  downstream_remote: string;
  // RequestedServer is the String value set on ssl connection socket for Server Name Indication (SNI) %REQUESTED_SERVER_NAME%
  requested_server: string;
  // RouteName is the name of the VirtualService route which matched this request %ROUTE_NAME%
  route_name: string;
  // UpstreamFailureReason is the upstream transport failure reason %UPSTREAM_TRANSPORT_FAILURE_REASON%
  upstream_failure_reason: string;
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
}

export interface EnvoyProxyDump {
  configDump?: EnvoyConfigDump;
  bootstrap?: BootstrapSummary;
  clusters?: ClusterSummary[];
  listeners?: ListenerSummary[];
  routes?: RouteSummary[];
}

export interface EnvoyConfigDump {
  configs: any[];
}

export type EnvoySummary = ClusterSummary | RouteSummary | ListenerSummary;

export interface ClusterSummary {
  service_fqdn: Host;
  port: number;
  subset: string;
  direction: string;
  type: number;
  destination_rule: string;
}

export interface ListenerSummary {
  address: string;
  port: number;
  match: string;
  destination: string;
}

export interface RouteSummary {
  name: string;
  domains: Host;
  match: string;
  virtual_service: string;
}

export interface BootstrapSummary {
  bootstrap: any;
}

export interface Service {
  name: string;
  createdAt: string;
  resourceVersion: string;
  namespace: Namespace;
  labels?: { [key: string]: string };
  type: string;
  ip: string;
  ports?: ServicePort[];
}

export interface Host {
  service: string;
  namespace: string;
  cluster?: string;
}

export interface IstioService {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: { [key: string]: string };
}

// 1.6
export interface L4MatchAttributes {
  destinationSubnets?: string[];
  port?: number;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
  sourceName?: string;
}

// 1.6
export interface TLSMatchAttributes {
  sniHosts: string[];
  destinationSubnets?: string[];
  port?: number;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
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
  set?: { [key: string]: string };
  add?: { [key: string]: string };
  remove?: string[];
}

// 1.6
export interface Headers {
  request?: HeaderOperations;
  response?: HeaderOperations;
}

// 1.6
export interface HTTPRouteDestination {
  destination: Destination;
  weight?: number;
  headers?: Headers;
}

// 1.6
export interface RouteDestination {
  destination: Destination;
  weight?: number;
}

// 1.6
export interface HTTPRedirect {
  uri?: string;
  authority?: string;
  redirectCode?: number;
}

// 1.6
export interface Delegate {
  name?: string;
  namespace?: string;
}

// 1.6
export interface HTTPRewrite {
  uri?: string;
  authority?: string;
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
  delay?: Delay;
  abort?: Abort;
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
  allowOrigin?: StringMatch[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: string;
  allowCredentials?: string;
}

// Destination Rule

export interface HTTPCookie {
  name: string;
  path?: string;
  ttl: string;
}

// 1.6
export interface ConsistentHashLB {
  httpHeaderName?: string | null;
  httpCookie?: HTTPCookie | null;
  useSourceIp?: boolean | null;
  httpQueryParameterName?: string | null;
  minimumRingSize?: number;
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
  failover?: Failover[];
  enabled?: boolean;
}

// 1.6
export interface LoadBalancerSettings {
  simple?: string | null;
  consistentHash?: ConsistentHashLB | null;
  localityLbSetting?: LocalityLoadBalancerSetting | null;
}

// 1.6
export interface TcpKeepalive {
  probes?: number;
  time?: string;
  interval?: string;
}

// 1.6
export interface ConnectionPoolSettingsTCPSettings {
  maxConnections?: number;
  connectTimeout?: string;
  tcpKeepalive?: TcpKeepalive;
}

// 1.6
export interface ConnectionPoolSettingsHTTPSettings {
  http1MaxPendingRequests?: number;
  http2MaxRequests?: number;
  maxRequestsPerConnection?: number;
  maxRetries?: number;
  idleTimeout?: string;
  h2UpgradePolicy?: string;
}

// 1.6
export interface ConnectionPoolSettings {
  tcp?: ConnectionPoolSettingsTCPSettings;
  http?: ConnectionPoolSettingsHTTPSettings;
}

// 1.6
export interface OutlierDetection {
  consecutiveErrors?: number;
  consecutive5xxErrors?: number;
  interval?: string;
  baseEjectionTime?: string;
  maxEjectionPercent?: number;
  minHealthPercent?: number;
}

// 1.6
export interface ClientTLSSettings {
  mode: string;
  clientCertificate?: string | null;
  privateKey?: string | null;
  caCertificates?: string | null;
  subjectAltNames?: string[] | null;
  sni?: string | null;
}

// 1.6
export interface PortTrafficPolicy {
  port?: PortSelector;
  loadBalancer?: LoadBalancerSettings;
  connectionPool?: ConnectionPoolSettings;
  outlierDetection?: OutlierDetection;
  tls?: ClientTLSSettings;
}

// 1.6
export interface TrafficPolicy {
  loadBalancer?: LoadBalancerSettings | null;
  connectionPool?: ConnectionPoolSettings;
  outlierDetection?: OutlierDetection;
  tls?: ClientTLSSettings | null;
  portLevelSettings?: PortTrafficPolicy[];
}

// 1.6
export interface Subset {
  name: string;
  labels?: { [key: string]: string };
  trafficPolicy?: TrafficPolicy;
}

// 1.6
export interface DestinationRuleSpec {
  host?: string;
  trafficPolicy?: TrafficPolicy | null;
  subsets?: Subset[];
  exportTo?: string[];
}

// 1.6
export interface DestinationRule extends IstioObject {
  spec: DestinationRuleSpec;
}

export interface DestinationRules {
  items: DestinationRule[];
  permissions: ResourcePermissions;
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
  subset?: string;
  port?: PortSelector;
}

// 1.6
export interface HTTPMatchRequest {
  name?: string;
  uri?: StringMatch;
  scheme?: StringMatch;
  method?: StringMatch;
  authority?: StringMatch;
  headers?: { [key: string]: StringMatch };
  port?: PortSelector;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
  queryParams?: { [key: string]: StringMatch };
  ignoreUriCase?: boolean;
  withoutHeaders?: { [key: string]: StringMatch };
  sourceNamespace?: string;
}

// 1.6
export interface HTTPRoute {
  name?: string;
  match?: HTTPMatchRequest[];
  route?: HTTPRouteDestination[];
  redirect?: HTTPRedirect;
  delegate?: Delegate;
  rewrite?: HTTPRewrite;
  timeout?: string;
  retries?: HTTPRetry;
  fault?: HTTPFaultInjection;
  mirror?: Destination;
  mirrorPercentage?: Percent;
  corsPolicy?: CorsPolicy;
  headers?: Headers;
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
  hosts?: string[];
  gateways?: string[] | null;
  http?: HTTPRoute[];
  tls?: TLSRoute[];
  tcp?: TCPRoute[];
  exportTo?: string[] | null;
}

// 1.6
export interface VirtualService extends IstioObject {
  spec: VirtualServiceSpec;
}

export interface VirtualServices {
  items: VirtualService[];
  permissions: ResourcePermissions;
}

export interface K8sOwnerReference {
  apiVersion?: string;
  kind?: string;
  name?: string;
  uid?: string;
  controller?: string;
  blockOwnerDeletion?: string;
}

// 1.6
export interface GatewaySpec {
  servers?: Server[];
  selector?: { [key: string]: string };
}

// 1.6
export interface Gateway extends IstioObject {
  spec: GatewaySpec;
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
  port?: Port;
  bind?: string;
  captureMode?: CaptureMode;
  hosts: string[];
  localhostServerTls?: ServerTLSSettings;
}

// 1.6
export interface IstioIngressListener {
  port: Port;
  bind?: string;
  captureMode?: CaptureMode;
  defaultEndpoint: string;
  localhostClientTls?: ClientTLSSettings;
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
  workloadSelector?: WorkloadSelector;
  ingress?: IstioIngressListener[];
  egress?: IstioEgressListener[];
  outboundTrafficPolicy?: OutboundTrafficPolicy;
  localhost?: Localhost;
}

// 1.6
export interface Sidecar extends IstioObject {
  spec: SidecarSpec;
}

// 1.6
export interface Server {
  port: ServerPort;
  hosts: string[];
  tls?: ServerTLSSettings;
}

// 1.6
export interface ServerPort {
  number: number;
  protocol: string;
  name: string;
}

// 1.6
export interface ServerTLSSettings {
  httpsRedirect?: boolean;
  mode?: string;
  serverCertificate?: string;
  privateKey?: string;
  caCertificates?: string;
  credentialName?: string;
  subjectAltNames?: string[];
  verifyCertificateSpki?: string[];
  verifyCertificateHash?: string[];
  minProtocolVersion?: string;
  maxProtocolVersion?: string;
  cipherSuites?: string[];
}

// 1.6
export interface ServiceEntrySpec {
  hosts?: string[];
  addresses?: string[];
  ports?: Port[];
  location?: string;
  resolution?: string;
  endpoints?: WorkloadEntrySpec[];
  exportTo?: string[];
  subjectAltNames?: string[];
  workloadSelector?: WorkloadSelector;
}

// 1.6
export interface ServiceEntry extends IstioObject {
  spec: ServiceEntrySpec;
}

export interface Endpoint {
  address: string;
  ports: { [key: string]: number };
  labels: { [key: string]: string };
}

export interface Match {
  clause: { [attributeName: string]: { [matchType: string]: string } };
}

export interface TargetSelector {
  name: string;
  ports?: PortSelector[];
}

export enum MutualTlsMode {
  STRICT = 'STRICT',
  PERMISSIVE = 'PERMISSIVE'
}

export interface MutualTls {
  allowTls: boolean;
  mode: MutualTlsMode;
}

export interface PeerAuthenticationMethod {
  mtls: MutualTls;
}

export interface Jwt {
  issuer: string;
  audiences: string[];
  jwksUri?: string;
  jwtHeaders: string[];
  jwtParams: string[];
}

export interface OriginAuthenticationMethod {
  jwt: Jwt;
}

export enum PrincipalBinding {
  USE_PEER = 'USE_PEER',
  USE_ORIGIN = 'USE_ORIGIN'
}

export interface AuthorizationPolicy extends IstioObject {
  spec: AuthorizationPolicySpec;
}

export interface AuthorizationPolicyWorkloadSelector {
  matchLabels: { [key: string]: string };
}

export interface AuthorizationPolicySpec {
  selector?: AuthorizationPolicyWorkloadSelector;
  rules?: AuthorizationPolicyRule[];
  action?: string;
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
  principals?: string[];
  notPrincipals?: string[];
  requestPrincipals?: string[];
  notRequestPrincipals?: string[];
  namespaces?: string[];
  notNamespaces?: string[];
  ipBlocks?: string[];
  notIpBlocks?: string[];
}

export interface RuleTo {
  operation: Operation;
}

export interface Operation {
  hosts?: string[];
  notHosts?: string[];
  ports?: string[];
  notPorts?: string[];
  methods?: string[];
  notMethods?: string[];
  paths?: string[];
  notPaths?: string[];
}

export interface Condition {
  key: string;
  values?: string[];
  notValues?: string[];
}

export interface PeerAuthentication extends IstioObject {
  spec: PeerAuthenticationSpec;
}

export interface PeerAuthenticationSpec {
  selector?: PeerAuthenticationWorkloadSelector;
  mtls?: PeerAuthenticationMutualTls;
  portLevelMtls?: { [key: number]: PeerAuthenticationMutualTls };
}

export interface PeerAuthenticationWorkloadSelector {
  matchLabels: { [key: string]: string };
}

export interface PeerAuthenticationMutualTls {
  mode: PeerAuthenticationMutualTLSMode;
}

export enum PeerAuthenticationMutualTLSMode {
  UNSET = 'UNSET',
  DISABLE = 'DISABLE',
  PERMISSIVE = 'PERMISSIVE',
  STRICT = 'STRICT'
}

// 1.6
export interface WorkloadEntry extends IstioObject {
  spec: WorkloadEntrySpec;
}

export interface WorkloadEntrySpec {
  address: string;
  ports?: { [key: string]: number };
  labels?: { [key: string]: string };
  network?: string;
  locality?: string;
  weight?: number;
  serviceAccount?: string;
}

export interface WorkloadGroup extends IstioObject {
  spec: WorkloadGroupSpec;
}

export interface WorkloadGroupSpec {
  // Note that WorkloadGroup has a metadata section inside Spec
  metadata?: K8sMetadata;
  template: WorkloadEntrySpec;
  probe?: ReadinessProbe;
}

export interface ReadinessProbe {
  initialDelaySeconds?: number;
  timeoutSeconds?: number;
  periodSeconds?: number;
  successThreshold?: number;
  failureThreshold?: number;
  httpGet?: HTTPHealthCheckConfig;
  tcpSocket?: TCPHealthCheckConfig;
  exec?: ExecHealthCheckConfig;
}

export interface HTTPHealthCheckConfig {
  path?: string;
  port: number;
  host?: string;
  scheme?: string;
  httpHeaders?: HTTPHeader[];
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
  issuer?: string;
  audiences?: string[];
  jwksUri?: string;
  jwks?: string;
  fromHeaders?: JWTHeader[];
  fromParams?: string[];
  outputPayloadToHeader?: string;
  forwardOriginalToken?: boolean;
}

// 1.6
export interface RequestAuthentication extends IstioObject {
  spec: RequestAuthenticationSpec;
}

// 1.6
export interface RequestAuthenticationSpec {
  selector?: WorkloadMatchSelector;
  jwtRules: JWTRule[];
}

export interface ProxyMatch {
  proxyVersion?: string;
  metadata?: { [key: string]: string };
}

export interface SubFilterMatch {
  name?: string;
}

export interface FilterMatch {
  name?: string;
  subFilter?: SubFilterMatch;
}

export interface FilterChainMatch {
  name?: string;
  sni?: string;
  transportProtocol?: string;
  applicationProtocols?: string;
  filter?: FilterMatch;
}

export interface ListenerMatch {
  portNumber?: number;
  filterChain?: FilterChainMatch;
}

export interface RouteMatch {
  name?: string;
  action?: string;
}

export interface VirtualHostMatch {
  name?: string;
  route?: RouteMatch;
}

export interface RouteConfigurationMatch {
  portNumber?: number;
  portName?: string;
  gateway?: string;
  vhost?: VirtualHostMatch;
  name?: string;
}

export interface ClusterMatch {
  portNumber?: number;
  service?: string;
  subset?: string;
  name?: string;
}

export interface EnvoyConfigObjectMatch {
  context?: string;
  proxy?: ProxyMatch;
  listener?: ListenerMatch;
  routeConfiguration?: RouteConfigurationMatch;
  cluster?: ClusterMatch;
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
  workloadSelector?: WorkloadSelector;
  configPatches: EnvoyConfigObjectPatch[];
}

export interface EnvoyFilter extends IstioObject {
  spec: EnvoyFilterSpec;
}

export interface AttributeInfo {
  description?: string;
  valueType: string;
}

export interface APIKey {
  query?: string;
  header?: string;
  cookie?: string;
}
