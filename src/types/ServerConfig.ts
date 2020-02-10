import { DurationInSeconds } from './Common';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName';

// 3scale public config, typically to check if addon/extension is enabled
interface ThreeScaleConfig {
  enabled: boolean;
}

// Kiali addons/extensions specific
interface Extensions {
  threescale: ThreeScaleConfig;
}

export interface ServerConfig {
  extensions?: Extensions;
  installationTag?: string;
  istioIdentityDomain: string;
  istioNamespace: string;
  istioComponentNamespaces?: Map<string, string>;
  istioLabels: { [key in IstioLabelKey]: string };
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
