import { DurationInSeconds } from './Common';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName' | 'injectionLabelName';

interface iter8Config {
  enabled: boolean;
}
// Kiali addons/extensions specific
interface Extensions {
  iter8: iter8Config;
}

interface IstioAnnotations {
  istioInjectionAnnotation: string;
}

interface KialiFeatureFlags {
  istioInjectionAction: boolean;
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
  extensions?: Extensions;
  healthConfig: HealthConfig;
  installationTag?: string;
  istioAnnotations: IstioAnnotations;
  istioIdentityDomain: string;
  istioNamespace: string;
  istioComponentNamespaces?: Map<string, string>;
  istioLabels: { [key in IstioLabelKey]: string };
  kialiFeatureFlags: KialiFeatureFlags;
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
