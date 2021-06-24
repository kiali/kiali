import { getExpr } from '../../config/HealthConfig';

export const healthConfig = {
  clusters: {},
  kialiFeatureFlags: {
    istioInjectionAction: true,
    istioUpgradeAction: false
  },
  healthConfig: {
    rate: [
      {
        namespace: getExpr(''),
        kind: getExpr(''),
        name: getExpr(''),
        tolerance: [
          {
            code: new RegExp(/^[4-5]\d\d$/),
            protocol: new RegExp('http'),
            direction: new RegExp('.*'),
            degraded: 0.1,
            failure: 20
          },
          {
            code: new RegExp(/^[1-9]$|^1[0-6]$/),
            protocol: new RegExp('grpc'),
            direction: new RegExp('.*'),
            degraded: 0.1,
            failure: 20
          }
        ]
      }
    ]
  },
  installationTag: 'Kiali Console',
  istioAnnotations: {
    istioInjectionAnnotation: ''
  },
  istioCanaryRevision: {
    current: '',
    upgrade: ''
  },
  istioIdentityDomain: 'svc.cluster.local',
  istioNamespace: 'istio-system',
  istioLabels: {
    appLabelName: 'app',
    injectionLabelName: 'istio-injection',
    injectionLabelRev: 'istio.io/rev',
    versionLabelName: 'version'
  },
  prometheus: {
    globalScrapeInterval: 15,
    storageTsdbRetention: 21600
  },
  durations: {},
  istioTelemetryV2: true
};

export const tolerancesDefault = [
  {
    code: new RegExp(/^[4-5]\d\d$/),
    protocol: new RegExp('http'),
    direction: new RegExp('.*'),
    degraded: 0.1,
    failure: 20
  },
  {
    code: new RegExp(/^[1-9]$|^1[0-6]$/),
    protocol: new RegExp('grpc'),
    direction: new RegExp('.*'),
    degraded: 0.1,
    failure: 20
  }
];
