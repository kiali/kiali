import { http, HttpResponse } from 'msw';
import { ServerConfig, RunMode } from '../../types/ServerConfig';
import { getScenarioConfig } from '../scenarios';
import { ChatAIConfig } from 'types/Chatbot';

// Cluster config type
type ClusterConfigType = Record<
  string,
  {
    accessible: boolean;
    apiEndpoint: string;
    isKialiHome: boolean;
    kialiInstances: Array<{
      namespace: string;
      operatorResource: string;
      serviceName: string;
      url: string;
      version: string;
    }>;
    name: string;
    secretName: string;
  }
>;

// Generate clusters config from scenario - called dynamically
const generateClustersConfig = (): ClusterConfigType => {
  const scenarioConfig = getScenarioConfig();
  const clusters: ClusterConfigType = {};

  scenarioConfig.clusters.forEach(cluster => {
    clusters[cluster.name] = {
      accessible: cluster.accessible,
      apiEndpoint: `https://${cluster.name}.kubernetes.default.svc`,
      isKialiHome: cluster.isHome,
      kialiInstances: cluster.isHome
        ? [
            {
              namespace: 'istio-system',
              operatorResource: '',
              serviceName: 'kiali',
              url: 'http://localhost:20001/kiali',
              version: 'dev'
            }
          ]
        : [],
      name: cluster.name,
      secretName: cluster.isHome ? '' : `${cluster.name}-secret`
    };
  });

  return clusters;
};

// Generate control planes from scenario - called dynamically
const generateControlPlanes = (): Record<string, string> => {
  const scenarioConfig = getScenarioConfig();
  const controlPlanes: Record<string, string> = {};
  scenarioConfig.clusters.forEach(cluster => {
    controlPlanes[cluster.name] = 'istio-system';
  });
  return controlPlanes;
};

const generateChatAIConfig = (): ChatAIConfig => {
  const scenarioConfig = getScenarioConfig();
  if (!scenarioConfig.chatAI) {
    return {
      enabled: false,
      providers: [],
      defaultProvider: ''
    };
  }
  return {
    enabled: scenarioConfig.chatAI.enabled ?? false,
    providers:
      scenarioConfig.chatAI.providers?.map(provider => ({
        name: provider.name,
        description: provider.description ?? '',
        defaultModel: provider.defaultModel ?? '',
        models:
          provider.models?.map(model => ({
            name: model.name,
            description: model.description ?? '',
            model: model.model ?? ''
          })) ?? []
      })) ?? [],
    defaultProvider: scenarioConfig.chatAI.defaultProvider ?? ''
  };
};

// Generate server config dynamically based on scenario
const generateServerConfig = (): ServerConfig => {
  const scenarioConfig = getScenarioConfig();
  return {
    ambientEnabled: scenarioConfig.ambientEnabled,
    authStrategy: 'anonymous',
    chatAI: generateChatAIConfig(),
    clusterWideAccess: true,
    clusters: generateClustersConfig(),
    controlPlanes: generateControlPlanes(),
    deployment: {
      viewOnlyMode: false
    },
    gatewayAPIClasses: [
      {
        className: 'istio',
        name: 'Istio'
      }
    ],
    gatewayAPIEnabled: true,
    healthConfig: {
      rate: [
        {
          tolerance: [
            {
              code: '5XX',
              degraded: 0.1,
              failure: 20,
              protocol: 'http',
              direction: '.*'
            },
            {
              code: '4XX',
              degraded: 10,
              failure: 20,
              protocol: 'http',
              direction: '.*'
            },
            {
              code: '-',
              degraded: 0.1,
              failure: 20,
              protocol: 'grpc',
              direction: '.*'
            }
          ]
        }
      ]
    },
    ignoreHomeCluster: false,
    installationTag: 'Kiali Mock',
    istioAPIInstalled: false,
    istioAnnotations: {
      ambientAnnotation: 'ambient.istio.io/redirection',
      ambientAnnotationEnabled: 'enabled',
      istioInjectionAnnotation: 'sidecar.istio.io/inject'
    },
    istioGatewayInstalled: true,
    istioIdentityDomain: 'svc.cluster.local',
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
    kialiFeatureFlags: {
      disabledFeatures: [],
      istioAnnotationAction: true,
      istioInjectionAction: true,
      istioUpgradeAction: true,
      uiDefaults: {
        graph: {
          findOptions: [],
          hideOptions: [],
          settings: {
            animation: 'point'
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
          showSelector: true
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
        tracing: {
          limit: 100
        }
      }
    },
    logLevel: 'info',
    prometheus: {
      globalScrapeInterval: 15,
      storageTsdbRetention: 604800
    },
    runMode: RunMode.APP
  };
};

const mockDisabledFeatures = {
  requestSize: false,
  requestSizeAverage: false,
  requestSizePercentiles: false,
  responseSize: false,
  responseSizeAverage: false,
  responseSizePercentiles: false,
  responseTime: false,
  responseTimeAverage: false,
  responseTimePercentiles: false
};

export const configHandlers = [
  http.get('*/api/config', () => {
    return HttpResponse.json(generateServerConfig());
  }),

  http.get('*/api/config/disabled', () => {
    return HttpResponse.json(mockDisabledFeatures);
  })
];
