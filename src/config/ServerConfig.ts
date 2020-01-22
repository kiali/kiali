import { ServerConfig } from '../types/ServerConfig';

export type Durations = { [key: number]: string };

export type ComputedServerConfig = ServerConfig & {
  durations: Durations;
};

const toDurations = (tupleArray: [number, string][]): Durations => {
  const obj = {};
  tupleArray.forEach(tuple => {
    obj[tuple[0]] = tuple[1];
  });
  return obj;
};

const durationsTuples: [number, string][] = [
  [60, '1m Traffic'],
  [300, '5m Traffic'],
  [600, '10m Traffic'],
  [1800, '30m Traffic'],
  [3600, '1h Traffic'],
  [10800, '3h Traffic'],
  [21600, '6h Traffic'],
  [43200, '12h Traffic'],
  [86400, '1d Traffic'],
  [604800, '7d Traffic'],
  [2592000, '30d Traffic']
];

const computeValidDurations = (cfg: ComputedServerConfig) => {
  let filtered = durationsTuples;
  if (cfg.prometheus.storageTsdbRetention) {
    // Make sure we'll keep at least one item
    if (cfg.prometheus.storageTsdbRetention <= durationsTuples[0][0]) {
      filtered = [durationsTuples[0]];
    } else {
      filtered = durationsTuples.filter(d => d[0] <= cfg.prometheus.storageTsdbRetention!);
    }
  }
  cfg.durations = toDurations(filtered);
};

// Set some defaults. Mainly used in tests, because
// these will be overwritten on user login.
let serverConfig: ComputedServerConfig = {
  installationTag: 'Kiali Console',
  istioIdentityDomain: 'svc.cluster.local',
  istioNamespace: 'istio-system',
  istioComponentNamespaces: new Map<string, string>(),
  istioLabels: {
    appLabelName: 'app',
    versionLabelName: 'version'
  },
  prometheus: {
    globalScrapeInterval: 15,
    storageTsdbRetention: 21600
  },
  durations: {}
};
computeValidDurations(serverConfig);
export { serverConfig };

export const toValidDuration = (duration: number): number => {
  // Check if valid
  if (serverConfig.durations[duration]) {
    return duration;
  }
  // Get closest duration
  for (let i = durationsTuples.length - 1; i >= 0; i--) {
    if (duration > durationsTuples[i][0]) {
      return durationsTuples[i][0];
    }
  }
  return durationsTuples[0][0];
};

export const setServerConfig = (svcConfig: ServerConfig) => {
  serverConfig = {
    ...svcConfig,
    durations: {}
  };

  computeValidDurations(serverConfig);
};

export const isIstioNamespace = (namespace: string): boolean => {
  if (namespace === serverConfig.istioNamespace) {
    return true;
  }
  return serverConfig.istioComponentNamespaces
    ? Object.values(serverConfig.istioComponentNamespaces).includes(namespace)
    : false;
};
