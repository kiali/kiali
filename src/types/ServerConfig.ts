import { DurationInSeconds } from './Common';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName' | 'injectionLabelName';

// 3scale public config, typically to check if addon/extension is enabled
interface ThreeScaleConfig {
  adapterName: string;
  adapterPort: string;
  adapterService: string;
  enabled: boolean;
  templateName: string;
}
interface iter8Config {
  enabled: boolean;
}
// Kiali addons/extensions specific
interface Extensions {
  threescale: ThreeScaleConfig;
  iter8: iter8Config;
}

interface IstioAnnotations {
  istioInjectionAnnotation: string;
}

interface KialiFeatureFlags {
  istioInjectionAction: boolean;
}

export interface ServerConfig {
  extensions?: Extensions;
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
  istioTelemetryV2: boolean;
}
