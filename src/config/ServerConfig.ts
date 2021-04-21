import _ from 'lodash';
import { ServerConfig } from '../types/ServerConfig';
import { parseHealthConfig } from './HealthConfig';

export type Durations = { [key: number]: string };

export type ComputedServerConfig = ServerConfig & {
  durations: Durations;
};

export const humanDurations = (cfg: ComputedServerConfig, prefix?: string, suffix?: string) =>
  _.mapValues(cfg.durations, v => _.reject([prefix, v, suffix], _.isEmpty).join(' '));

const toDurations = (tupleArray: [number, string][]): Durations => {
  const obj = {};
  tupleArray.forEach(tuple => {
    obj[tuple[0]] = tuple[1];
  });
  return obj;
};

const durationsTuples: [number, string][] = [
  [60, '1m'],
  [300, '5m'],
  [600, '10m'],
  [1800, '30m'],
  [3600, '1h'],
  [10800, '3h'],
  [21600, '6h'],
  [43200, '12h'],
  [86400, '1d'],
  [604800, '7d'],
  [2592000, '30d']
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

// Set some reasonable defaults. Initial values should be valid for fields
// than may not be providedby/set on the server.
const defaultServerConfig: ComputedServerConfig = {
  clusters: {},
  durations: {},
  healthConfig: {
    rate: []
  },
  installationTag: 'Kiali Console',
  istioAnnotations: {
    istioInjectionAnnotation: 'sidecar.istio.io/inject'
  },
  istioIdentityDomain: 'svc.cluster.local',
  istioNamespace: 'istio-system',
  istioComponentNamespaces: new Map<string, string>(),
  istioLabels: {
    appLabelName: 'app',
    injectionLabelName: 'istio-injection',
    versionLabelName: 'version'
  },
  kialiFeatureFlags: {
    istioInjectionAction: true
  },
  prometheus: {
    globalScrapeInterval: 15,
    storageTsdbRetention: 21600
  }
};

// Overwritten with real server config on user login. Also used for tests.
let serverConfig = defaultServerConfig;
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

export const setServerConfig = (cfg: ServerConfig) => {
  serverConfig = {
    ...defaultServerConfig,
    ...cfg
  };
  serverConfig.healthConfig = cfg.healthConfig ? parseHealthConfig(cfg.healthConfig) : serverConfig.healthConfig;

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
