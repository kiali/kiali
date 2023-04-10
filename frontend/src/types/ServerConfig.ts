import { DurationInSeconds } from './Common';
import { MeshCluster } from './Mesh';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName' | 'injectionLabelName' | 'injectionLabelRev';

interface ClusterInfo {
  name: string;
  network: string;
}

interface DeploymentConfig {
  viewOnlyMode: boolean;
}

interface IstioAnnotations {
  // this could also be the name of the pod label, both label and annotation are supported
  istioInjectionAnnotation: string;
}

interface GraphFindOption {
  description: string;
  expression: string;
}

interface GraphTraffic {
  grpc: string;
  http: string;
  tcp: string;
}

interface GraphSettings {
  fontLabel: number;
  minFontBadge: number;
  minFontLabel: number;
}

interface GraphUIDefaults {
  findOptions: GraphFindOption[];
  hideOptions: GraphFindOption[];
  settings: GraphSettings;
  traffic: GraphTraffic;
}

interface ListUIDefaults {
  includeHealth: boolean;
  includeIstioResources: boolean;
  includeValidations: boolean;
  showIncludeToggles: boolean;
}

interface UIDefaults {
  graph: GraphUIDefaults;
  list: ListUIDefaults;
  metricsPerRefresh?: string;
  namespaces?: string[];
  refreshInterval?: string;
}

interface CertificatesInformationIndicators {
  enabled: boolean;
}

interface KialiFeatureFlags {
  certificatesInformationIndicators: CertificatesInformationIndicators;
  disabledFeatures: string[];
  istioInjectionAction: boolean;
  istioAnnotationAction: boolean;
  istioUpgradeAction: boolean;
  uiDefaults: UIDefaults;
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

interface IstioCanaryRevision {
  current: string;
  upgrade: string;
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
  namespace?: RegexConfig;
  kind?: RegexConfig;
  name?: RegexConfig;
  tolerance: ToleranceConfig[];
}
// toleranceConfig
export interface ToleranceConfig {
  code: RegexConfig;
  degraded: number;
  failure: number;
  protocol?: RegexConfig;
  direction?: RegexConfig;
}

/*
 End Health Config
*/

export interface ServerConfig {
  accessibleNamespaces: Array<string>;
  ambientEnabled: boolean;
  authStrategy: string;
  clusterInfo?: ClusterInfo;
  clusters: { [key: string]: MeshCluster };
  deployment: DeploymentConfig;
  gatewayAPIEnabled: boolean;
  healthConfig: HealthConfig;
  installationTag?: string;
  istioAnnotations: IstioAnnotations;
  istioCanaryRevision: IstioCanaryRevision;
  istioIdentityDomain: string;
  istioNamespace: string;
  istioLabels: { [key in IstioLabelKey]: string };
  kialiFeatureFlags: KialiFeatureFlags;
  logLevel: string;
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
