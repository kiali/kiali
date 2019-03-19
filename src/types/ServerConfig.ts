import { DurationInSeconds } from './Common';

export type IstioLabelKey = 'appLabelName' | 'versionLabelName';

export interface ServerConfig {
  installationTag?: string;
  istioNamespace: string;
  istioLabels: { [key in IstioLabelKey]: string };
  prometheus: {
    globalScrapeInterval?: DurationInSeconds;
    storageTsdbRetention?: DurationInSeconds;
  };
}
