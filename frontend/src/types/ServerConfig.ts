import { DurationInSeconds } from './Common';
import { MeshCluster } from './Mesh';

export type IstioLabelKey =
  | 'ambientNamespaceLabel'
  | 'ambientNamespaceLabelValue'
  | 'ambientWaypointGatewayLabel'
  | 'ambientWaypointLabel'
  | 'ambientWaypointLabelValue'
  | 'appLabelName'
  | 'injectionLabelName'
  | 'injectionLabelRev'
  | 'versionLabelName';

interface DeploymentConfig {
  viewOnlyMode: boolean;
}

interface IstioAnnotations {
  ambientAnnotation: string;
  ambientAnnotationEnabled: string;
  // this could also be the name of the pod label, both label and annotation are supported
  istioInjectionAnnotation: string;
}

interface GraphFindOption {
  autoSelect: boolean;
  description: string;
  expression: string;
}

interface GraphTraffic {
  ambient: string;
  grpc: string;
  http: string;
  tcp: string;
}

interface GraphSettings {
  animation: 'point' | 'dash';
}

interface GraphUIDefaults {
  findOptions: GraphFindOption[];
  hideOptions: GraphFindOption[];
  settings: GraphSettings;
  traffic: GraphTraffic;
}

interface I18nUIDefaults {
  language: string;
  showSelector: boolean;
}

interface ListUIDefaults {
  includeHealth: boolean;
  includeIstioResources: boolean;
  includeValidations: boolean;
  showIncludeToggles: boolean;
}

interface MeshUIDefaults {
  findOptions: GraphFindOption[];
  hideOptions: GraphFindOption[];
}

interface TracingDefaults {
  limit: number;
}

interface UIDefaults {
  graph: GraphUIDefaults;
  i18n: I18nUIDefaults;
  list: ListUIDefaults;
  mesh: MeshUIDefaults;
  metricsPerRefresh?: string;
  namespaces?: string[];
  refreshInterval?: string;
  tracing: TracingDefaults;
}

interface KialiFeatureFlags {
  disabledFeatures: string[];
  istioAnnotationAction: boolean;
  istioInjectionAction: boolean;
  istioUpgradeAction: boolean;
  uiDefaults: UIDefaults;
}

export interface GatewayAPIClass {
  className: string;
  name: string;
}

// Not based exactly on Kiali configuration but rather whether things like prometheus config
// allow for certain Kiali features. True means the feature is crippled, false means supported.
export interface KialiCrippledFeatures {
  requestSize: boolean;
  requestSizeAverage: boolean;
  requestSizePercentiles: boolean;
  responseSize: boolean;
  responseSizeAverage: boolean;
  responseSizePercentiles: boolean;
  responseTime: boolean;
  responseTimeAverage: boolean;
  responseTimePercentiles: boolean;
}

/*
 Health Config
*/
export type RegexConfig = string | RegExp;

export interface HealthConfig {
  rate: RateHealthConfig[];
}

// rateHealthConfig
export interface RateHealthConfig {
  kind?: RegexConfig;
  name?: RegexConfig;
  namespace?: RegexConfig;
  tolerance: ToleranceConfig[];
}
// toleranceConfig
export interface ToleranceConfig {
  code: RegexConfig;
  degraded: number;
  direction?: RegexConfig;
  failure: number;
  protocol?: RegexConfig;
}

/*
 End Health Config
*/

export interface ServerConfig {
  ambientEnabled: boolean;
  authStrategy: string;
  clusterWideAccess: boolean;
  clusters: { [key: string]: MeshCluster }; // cluster => MeshCluster
  controlPlanes: { [key: string]: string }; // cluster => namespace
  deployment: DeploymentConfig;
  gatewayAPIClasses: GatewayAPIClass[];
  gatewayAPIEnabled: boolean;
  healthConfig: HealthConfig;
  ignoreLocalCluster: boolean;
  installationTag?: string;
  istioAnnotations: IstioAnnotations;
  istioIdentityDomain: string;
  istioLabels: { [key in IstioLabelKey]: string };
  kialiFeatureFlags: KialiFeatureFlags;
  logLevel: string;
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
