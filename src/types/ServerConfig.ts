import { DurationInSeconds } from './Common';
import { MeshCluster } from './Mesh';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName' | 'injectionLabelName' | 'injectionLabelRev';

interface iter8Config {
  enabled: boolean;
}

interface ClusterInfo {
  name: string;
  network: string;
}

// Kiali addons/extensions specific
interface Extensions {
  iter8: iter8Config;
}

interface DeploymentConfig {
  viewOnlyMode: boolean;
}

interface IstioAnnotations {
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

interface GraphUIDefaults {
  findOptions: GraphFindOption[];
  hideOptions: GraphFindOption[];
  traffic: GraphTraffic;
}

interface UIDefaults {
  graph: GraphUIDefaults;
  metricsPerRefresh?: string;
  namespaces?: string[];
  refreshInterval?: string;
}

interface CertificatesInformationIndicators {
  enabled: boolean;
}

interface KialiFeatureFlags {
  certificatesInformationIndicators: CertificatesInformationIndicators;
  istioInjectionAction: boolean;
  istioUpgradeAction: boolean;
  uiDefaults?: UIDefaults;
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
  clusterInfo?: ClusterInfo;
  clusters: { [key: string]: MeshCluster };
  extensions?: Extensions;
  deployment: DeploymentConfig;
  healthConfig: HealthConfig;
  installationTag?: string;
  istioAnnotations: IstioAnnotations;
  istioCanaryRevision: IstioCanaryRevision;
  istioIdentityDomain: string;
  istioNamespace: string;
  istioLabels: { [key in IstioLabelKey]: string };
  kialiFeatureFlags: KialiFeatureFlags;
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
