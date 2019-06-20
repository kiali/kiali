import Namespace from './Namespace';
import { ResourcePermissions } from './Permissions';

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
}

// validations are grouped per 'objectType' first in the first map and 'name' in the inner map
export type Validations = { [key1: string]: { [key2: string]: ObjectValidation } };

export interface ObjectValidation {
  name: string;
  objectType: string;
  valid: boolean;
  checks: ObjectCheck[];
}

export interface ObjectCheck {
  message: string;
  severity: string;
  path: string;
}

export interface Reference {
  name: string;
  kind: string;
}

export interface ContainerInfo {
  name: string;
  image: string;
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
  ports?: Port[];
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

export interface StringMatch {
  exact?: string;
  prefix?: string;
  regex?: string;
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
  delay?: Delay;
  abort?: Abort;
}

export interface Delay {
  percent: number;
  fixedDelay: string;
  exponentialDelay: string;
  overrideHeaderName: string;
}

export interface Percent {
  value: number;
}

export interface Abort {
  percent?: number;
  httpStatus?: number;
  percentage?: Percent;
}

export interface Throttle {
  percent: number;
  downstreamLimitBps: number;
  upstreamLimitBps: number;
  throttleAfterPeriod: string;
  throttleAfterBytes: number;
  throttleForPeriod: string;
}

export interface CorsPolicy {
  allowOrigin: string[];
  allowMethods: string[];
  allowHeaders: string[];
  exposeHeaders: string[];
  maxAge: string;
  allowCredentials: string;
}

// Destination Rule

export interface HTTPCookie {
  name: string;
  path?: string;
  ttl: string;
}

export interface ConsistentHashLB {
  httpHeaderName?: string | null;
  httpCookie?: HTTPCookie | null;
  useSourceIp?: boolean | null;
  minimumRingSize?: number;
}

export interface LoadBalancerSettings {
  simple?: string | null;
  consistentHash?: ConsistentHashLB | null;
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
  clientCertificate?: string;
  privateKey?: string;
  caCertificates?: string;
  subjectAltNames?: string[];
  sni?: string;
}

export interface TrafficPolicy {
  loadBalancer?: LoadBalancerSettings | null;
  connectionPool?: ConnectionPoolSettings;
  outlierDetection?: OutlierDetection;
  tls?: TLSSettings | null;
}

export interface Subset {
  name: string;
  labels: { [key: string]: string };
  trafficPolicy?: TrafficPolicy;
}

export interface DestinationRuleSpec {
  host?: string;
  trafficPolicy?: TrafficPolicy | null;
  subsets?: Subset[];
}

export interface DestinationRule extends IstioObject {
  spec: DestinationRuleSpec;
}

export interface DestinationRules {
  items: DestinationRule[];
  permissions: ResourcePermissions;
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
  uri?: StringMatch;
  scheme?: StringMatch;
  method?: StringMatch;
  authority?: StringMatch;
  headers?: { [key: string]: StringMatch };
  port?: PortSelector;
  sourceLabels?: { [key: string]: string };
  gateways?: string[];
}

export interface HTTPRoute {
  match?: HTTPMatchRequest[];
  route?: DestinationWeight[];
  redirect?: HTTPRedirect;
  rewrite?: HTTPRewrite;
  websocketUpgrade?: boolean;
  timeout?: string;
  retries?: HTTPRetry;
  fault?: HTTPFaultInjection;
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

export interface VirtualServiceSpec {
  hosts?: string[];
  gateways?: string[] | null;
  http?: HTTPRoute[];
  tcp?: TCPRoute[];
  tls?: TLSRoute[];
  exportTo?: string[] | null;
}

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

export interface GatewaySpec {
  servers?: Server[];
  selector?: { [key: string]: string };
}

export interface Gateway extends IstioObject {
  spec: GatewaySpec;
}

// Sidecar resource https://preliminary.istio.io/docs/reference/config/networking/v1alpha3/sidecar

export enum CaptureMode {
  DEFAULT = 'DEFAULT',
  IPTABLES = 'IPTABLES',
  NONE = 'NONE'
}

export interface IstioEgressListener {
  port?: Port;
  bind?: string;
  captureMode?: CaptureMode;
  hosts: string[];
}

export interface IstioIngressListener {
  port: Port;
  bind?: string;
  captureMode?: CaptureMode;
  defaultEndpoint: string;
}

export interface WorkloadSelector {
  labels: { [key: string]: string };
}

export interface SidecarSpec {
  workloadSelector?: WorkloadSelector;
  ingress?: IstioIngressListener;
  egress?: IstioEgressListener;
}

export interface Sidecar extends IstioObject {
  spec: SidecarSpec;
}

export interface Server {
  port: ServerPort;
  hosts: string[];
  tls?: TLSOptions;
}

export interface ServerPort {
  number: number;
  protocol: string;
  name: string;
}

export interface TLSOptions {
  httpsRedirect: boolean;
  mode: string;
  serverCertificate: string;
  privateKey: string;
  caCertificates: string;
  subjectAltNames: string[];
}

export interface ServiceEntrySpec {
  hosts?: string[];
  addresses?: string[];
  ports?: Port[];
  location?: string;
  resolution?: string;
  endpoints?: Endpoint[];
  exportTo?: string[];
  subjectAltNames?: string[];
}

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
  adapter: string;
  adapters: string;
}

export interface IstioTemplate extends IstioObject {
  spec: any;
  template: string;
  templates: string;
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

export interface PortSelector {
  name: string;
  number: number;
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
  properties: Map<string, string>;
}
