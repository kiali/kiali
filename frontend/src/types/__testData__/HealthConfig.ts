import { ServerConfig } from 'types/ServerConfig';
import { getExpr } from '../../config/HealthConfig';

export const healthConfig = {
  authStrategy: '',
  ambientEnabled: false,
  clusters: {},
  clusterWideAccess: true,
  controlPlanes: { Kubernetes: 'istio-system' },
  gatewayAPIClasses: [],
  gatewayAPIEnabled: false,
  grafana: {},
  ignoreHomeCluster: false,
  logLevel: '',
  kialiFeatureFlags: {
    disabledFeatures: [],
    istioInjectionAction: true,
    istioAnnotationAction: true,
    istioUpgradeAction: false,
    uiDefaults: {
      graph: {
        findOptions: [],
        hideOptions: [],
        impl: 'pf',
        settings: {
          animation: 'point',
          fontLabel: 13,
          minFontBadge: 7,
          minFontLabel: 10
        },
        traffic: {
          ambient: 'total',
          grpc: 'requests',
          http: 'requests',
          tcp: 'sent'
        }
      },
      i18n: {
        language: 'en',
        showSelector: false
      },
      list: {
        includeHealth: true,
        includeIstioResources: true,
        includeValidations: true,
        showIncludeToggles: false
      },
      mesh: {
        findOptions: [],
        hideOptions: []
      },
      metricsPerRefresh: '1m',
      namespaces: [],
      refreshInterval: '15s',
      tracing: { limit: 100 }
    }
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
    ambientAnnotation: 'ambient.istio.io/redirection',
    ambientAnnotationEnabled: 'enabled',
    istioInjectionAnnotation: ''
  },
  istioIdentityDomain: 'svc.cluster.local',
  istioNamespace: 'istio-system',
  istioLabels: {
    ambientNamespaceLabel: 'istio.io/dataplane-mode',
    ambientNamespaceLabelValue: 'ambient',
    ambientWaypointGatewayLabel: 'gateway.networking.k8s.io/gateway-name',
    ambientWaypointLabel: 'gateway.istio.io/managed',
    ambientWaypointLabelValue: 'istio.io-mesh-controller',
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
  istioTelemetryV2: true,
  deployment: {
    viewOnlyMode: false
  }
} as ServerConfig;

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
