import Namespace from './Namespace';
import { ResourcePermissions } from './Permissions';
import { ServicePort } from './ServiceInfo';

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
  validationMessages: ValidationMessage[];
  conditions?: any[];
}

export interface ValidationMessage {
  code: string;
  documentation_url: string;
  level: string;
  message: string;
}

// validations are grouped per 'objectType' first in the first map and 'name' in the inner map
export type Validations = { [key1: string]: { [key2: string]: ObjectValidation } };

export enum ValidationTypes {
  Error = 'error',
  Warning = 'warning',
  Correct = 'correct',
  Info = 'info'
}

export interface ObjectValidation {
  name: string;
  objectType: string;
  valid: boolean;
  checks: ObjectCheck[];
  references?: ObjectReference[];
}

export interface ObjectCheck {
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
}

// 1.6
export interface Port {
  number: number;
  protocol: string;
  name: string;
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
  appLabel: boolean;
  versionLabel: boolean;
}

export type Logs = string;

export interface PodLogs {
  logs?: Logs;
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

export interface IstioRuleSpec {
  match: string;
  actions: IstioRuleActionItem[];
}

export interface IstioRule extends IstioObject {
  spec: IstioRuleSpec;
}

export interface IstioRuleActionItem {
  handler: string;
  instances: string[];
}

export interface IstioAdapter extends IstioObject {
  spec: any;
}

export interface IstioTemplate extends IstioObject {
  spec: any;
}

export interface IstioHandler extends IstioObject {
  spec: any;
}

export interface IstioInstance extends IstioObject {
  spec: any;
}

export interface QuotaSpecSpec {
  rules?: MatchQuota[];
}

export interface QuotaSpec extends IstioObject {
  spec: QuotaSpecSpec;
}

export interface MatchQuota {
  match?: Match;
  quotas?: Quota;
}

export interface Match {
  clause: { [attributeName: string]: { [matchType: string]: string } };
}

export interface Quota {
  quota: string;
  charge: number;
}

export interface QuotaSpecBindingSpec {
  quotaSpecs?: QuotaSpecRef[];
  services?: IstioService[];
}

export interface QuotaSpecBinding extends IstioObject {
  spec: QuotaSpecBindingSpec;
}

export interface QuotaSpecRef {
  name: string;
  namespace?: string;
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

export interface PolicySpec {
  targets?: TargetSelector[];
  peers?: PeerAuthenticationMethod[];
  peerIsOptional?: boolean;
  origins?: OriginAuthenticationMethod[];
  originIsOptional?: boolean;
  principalBinding?: PrincipalBinding;
}

export interface Policy extends IstioObject {
  spec: PolicySpec;
}

export interface ClusterRbacConfig extends IstioObject {
  spec: ClusterRbacConfigSpec;
}

export interface ClusterRbacConfigSpec {
  mode?: string;
  inclusion?: ClusterRbacConfigTarget;
  exclusion?: ClusterRbacConfigTarget;
}

export interface ClusterRbacConfigTarget {
  services: string[];
  namespaces: string[];
}

export interface RbacConfig extends IstioObject {
  spec: RbacConfigSpec;
}

export interface RbacConfigSpec {
  mode?: string;
  inclusion?: RbacConfigTarget;
  exclusion?: RbacConfigTarget;
}

export interface RbacConfigTarget {
  services: string[];
  namespaces: string[];
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

export interface ServiceRole extends IstioObject {
  spec: ServiceRoleSpec;
}

export interface ServiceRoleSpec {
  rules?: AccessRules[];
}

export interface AccessRules {
  service: string[];
  path: string[];
  methods: string[];
  constraints: AccessRuleConstraint;
}

export interface AccessRuleConstraint {
  key: string;
  values: string[];
}

export interface ServiceRoleBinding extends IstioObject {
  spec: ServiceRoleBindingSpec;
}

export interface ServiceRoleBindingSpec {
  subjects?: ServiceRoleBindingSubject[];
  roleRef?: Reference;
}

export interface ServiceRoleBindingSubject {
  user: string;
  properties: { [key: string]: string };
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

export interface WorkloadEntrySelector {
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
  selector?: WorkloadEntrySelector;
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

export interface AttributeManifestSpec {
  revision?: string;
  name: string;
  attributes?: { [key: string]: AttributeInfo };
}

export interface AttributeManifest extends IstioObject {
  spec: AttributeManifestSpec;
}

export interface HTTPAPISpecPattern {
  attributes?: { [key: string]: { [key: string]: string } };
  httpMethod?: string;
  uriTemplate?: string;
  regex?: string;
}

export interface APIKey {
  query?: string;
  header?: string;
  cookie?: string;
}

// Attribute Value is mapped as an inner map of string
export interface HTTPAPISpecSpec {
  attributes?: { [key: string]: { [key: string]: string } };
  patterns?: HTTPAPISpecPattern[];
  apiKeys?: APIKey[];
}

export interface HTTPAPISpec extends IstioObject {
  spec: HTTPAPISpecSpec;
}

export interface IstioService {
  name?: string;
  namespace?: string;
  domain?: string;
  service?: string;
  labels?: { [key: string]: string };
}

export interface HTTPAPISpecReference {
  name: string;
  namespace?: string;
}

export interface HTTPAPISpecBindingSpec {
  services: IstioService[];
  apiSpecs: HTTPAPISpecReference[];
}

export interface HTTPAPISpecBinding extends IstioObject {
  spec: HTTPAPISpecBindingSpec;
}
