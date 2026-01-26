// Mesh graph generation
import { http, HttpResponse } from 'msw';
import { getScenarioConfig, getItemHealthStatus, isMultiCluster } from '../scenarios';
import { Status } from '../../types/IstioStatus';

// Map health status string to Status enum value
const getHealthData = (itemName: string, namespace: string): Status => {
  const healthStatus = getItemHealthStatus(itemName, namespace);
  switch (healthStatus) {
    case 'unhealthy':
      return Status.Unhealthy;
    case 'degraded':
      return Status.NotReady;
    default:
      return Status.Healthy;
  }
};

// Mesh config shared across clusters
const getMeshConfig = (): Record<string, unknown> => ({
  certificates: [
    {
      configMapName: 'istio-ca-root-cert',
      secretName: '',
      secretNamespace: 'istio-system',
      dnsNames: [],
      issuer: 'O=cluster.local',
      notAfter: '2036-01-18T07:43:00Z',
      notBefore: '2026-01-20T07:43:00Z',
      error: ''
    }
  ],
  effectiveConfig: {
    name: 'istio',
    namespace: 'istio-system',
    configMap: {
      mesh: {
        enableTracing: true,
        defaultConfig: { discoveryAddress: 'istiod.istio-system.svc:15012', meshId: 'mesh-default' },
        trustDomain: 'cluster.local',
        rootNamespace: 'istio-system',
        enablePrometheusMerge: true,
        extensionProviders: [
          {
            name: 'otel-tracing',
            opentelemetry: { service: 'jaeger-collector.istio-system.svc.cluster.local', port: 4317 }
          }
        ],
        defaultProviders: { metrics: ['prometheus'] }
      },
      meshNetworks: {}
    }
  },
  standardConfig: {
    name: 'istio',
    namespace: 'istio-system',
    configMap: {
      mesh: {
        enableTracing: true,
        defaultConfig: { discoveryAddress: 'istiod.istio-system.svc:15012', meshId: 'mesh-default' },
        trustDomain: 'cluster.local',
        rootNamespace: 'istio-system',
        enablePrometheusMerge: true,
        extensionProviders: [
          {
            name: 'otel-tracing',
            opentelemetry: { service: 'jaeger-collector.istio-system.svc.cluster.local', port: 4317 }
          }
        ],
        defaultProviders: { metrics: ['prometheus'] }
      },
      meshNetworks: {}
    }
  }
});

const generateMeshGraphData = (): Record<string, unknown> => {
  const scenarioConfig = getScenarioConfig();
  const nodes: any[] = [];
  const edges: any[] = [];
  const meshConfig = getMeshConfig();

  // Generate nodes for each cluster
  scenarioConfig.clusters.forEach(cluster => {
    const clusterBoxId = `box-${cluster.name}`;
    const istioSystemBoxId = `box-istio-system-${cluster.name}`;

    // Cluster box
    nodes.push({
      data: {
        id: clusterBoxId,
        nodeType: 'box',
        cluster: cluster.name,
        namespace: '',
        infraName: cluster.name,
        infraType: 'cluster',
        isBox: 'cluster',
        version: '1.28.0',
        infraData: {
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
        }
      }
    });

    // istio-system namespace box
    nodes.push({
      data: {
        id: istioSystemBoxId,
        nodeType: 'box',
        cluster: cluster.name,
        namespace: 'istio-system',
        infraName: 'istio-system',
        infraType: 'namespace',
        isBox: 'namespace',
        parent: clusterBoxId
      }
    });

    // Kiali node (only in home cluster)
    if (cluster.isHome) {
      nodes.push({
        data: {
          id: `kiali-${cluster.name}`,
          nodeType: 'infra',
          cluster: cluster.name,
          namespace: 'istio-system',
          infraName: 'kiali',
          infraType: 'kiali',
          isExternal: false,
          healthData: 'Healthy',
          version: 'dev',
          parent: istioSystemBoxId,
          infraData: {
            namespace: 'istio-system',
            operatorResource: '',
            serviceName: 'kiali',
            url: 'http://localhost:20001/kiali',
            version: 'dev'
          }
        }
      });
    }

    // istiod node
    nodes.push({
      data: {
        id: `istiod-${cluster.name}`,
        nodeType: 'infra',
        cluster: cluster.name,
        namespace: 'istio-system',
        infraName: 'istiod',
        infraType: 'istiod',
        isExternal: false,
        healthData: 'Healthy',
        version: '1.20.0',
        parent: istioSystemBoxId,
        infraData: {
          cluster: {
            accessible: cluster.accessible,
            apiEndpoint: `https://${cluster.name}.kubernetes.default.svc`,
            isKialiHome: cluster.isHome,
            kialiInstances: [],
            name: cluster.name,
            secretName: ''
          },
          istiodName: 'istiod',
          revision: 'default',
          thresholds: {},
          config: meshConfig,
          version: { version: '1.20.0' }
        }
      }
    });

    // Grafana (only in home cluster)
    if (cluster.isHome) {
      nodes.push({
        data: {
          id: `grafana-${cluster.name}`,
          nodeType: 'infra',
          cluster: cluster.name,
          namespace: 'istio-system',
          infraName: 'Grafana',
          infraType: 'grafana',
          isExternal: false,
          healthData: getHealthData('grafana', 'istio-system'),
          version: '12.0.1',
          parent: istioSystemBoxId,
          infraData: {
            auth: {
              certFile: '',
              insecureSkipVerify: false,
              keyFile: '',
              password: '',
              token: '',
              type: 'none',
              useKialiToken: false,
              username: ''
            },
            dashboards: [
              {
                name: 'Istio Service Dashboard',
                variables: {
                  datasource: 'var-datasource',
                  namespace: 'var-namespace',
                  service: 'var-service',
                  version: 'var-version'
                }
              },
              {
                name: 'Istio Workload Dashboard',
                variables: {
                  datasource: 'var-datasource',
                  namespace: 'var-namespace',
                  version: 'var-version',
                  workload: 'var-workload'
                }
              },
              { name: 'Istio Mesh Dashboard', variables: {} },
              { name: 'Istio Control Plane Dashboard', variables: {} },
              { name: 'Istio Performance Dashboard', variables: {} },
              { name: 'Istio Wasm Extension Dashboard', variables: {} }
            ],
            enabled: true,
            externalURL: '',
            internalURL: 'http://grafana.istio-system:3000'
          }
        }
      });

      // Prometheus (only in home cluster)
      nodes.push({
        data: {
          id: `prometheus-${cluster.name}`,
          nodeType: 'infra',
          cluster: cluster.name,
          namespace: 'istio-system',
          infraName: 'Prometheus',
          infraType: 'metricStore',
          isExternal: false,
          healthData: getHealthData('prometheus', 'istio-system'),
          version: '3.5.0',
          parent: istioSystemBoxId,
          infraData: {
            auth: {
              certFile: '',
              insecureSkipVerify: false,
              keyFile: '',
              password: '',
              token: '',
              type: 'none',
              useKialiToken: false,
              username: ''
            },
            cacheDuration: 7,
            cacheEnabled: true,
            cacheExpiration: 300,
            isCore: true,
            thanosProxy: { retentionPeriod: '7d', scrapeInterval: '30s' },
            url: 'http://prometheus.istio-system:9090'
          }
        }
      });
    }

    // Data Plane node for each cluster
    const dataPlaneNamespaces = cluster.namespaces
      .filter(ns => ns !== 'istio-system')
      .map(ns => ({
        name: ns,
        cluster: cluster.name,
        isAmbient: scenarioConfig.ambientEnabled && ns !== 'default',
        labels:
          scenarioConfig.ambientEnabled && ns !== 'default'
            ? { 'istio.io/dataplane-mode': 'ambient' }
            : ns === 'default'
            ? {}
            : { 'istio-injection': 'enabled' }
      }));

    nodes.push({
      data: {
        id: `dataplane-${cluster.name}`,
        nodeType: 'infra',
        cluster: cluster.name,
        namespace: '',
        infraName: 'Data Plane',
        infraType: 'dataplane',
        isExternal: false,
        healthData: 'Healthy',
        parent: clusterBoxId,
        infraData: dataPlaneNamespaces
      }
    });
  });

  // Generate edges
  scenarioConfig.clusters.forEach(cluster => {
    // istiod -> dataplane (each cluster)
    edges.push({
      data: {
        id: `edge-istiod-dataplane-${cluster.name}`,
        source: `istiod-${cluster.name}`,
        target: `dataplane-${cluster.name}`
      }
    });

    // Kiali edges (only from home cluster)
    if (cluster.isHome) {
      // Kiali -> istiod (home)
      edges.push({
        data: {
          id: `edge-kiali-istiod-${cluster.name}`,
          source: `kiali-${cluster.name}`,
          target: `istiod-${cluster.name}`
        }
      });

      // Kiali -> Grafana
      edges.push({
        data: {
          id: `edge-kiali-grafana-${cluster.name}`,
          source: `kiali-${cluster.name}`,
          target: `grafana-${cluster.name}`
        }
      });

      // Kiali -> Prometheus
      edges.push({
        data: {
          id: `edge-kiali-prometheus-${cluster.name}`,
          source: `kiali-${cluster.name}`,
          target: `prometheus-${cluster.name}`
        }
      });

      // Kiali -> remote istiods (multicluster)
      if (isMultiCluster()) {
        scenarioConfig.clusters
          .filter(c => !c.isHome)
          .forEach(remoteCluster => {
            edges.push({
              data: {
                id: `edge-kiali-remote-istiod-${remoteCluster.name}`,
                source: `kiali-${cluster.name}`,
                target: `istiod-${remoteCluster.name}`
              }
            });
          });
      }
    }
  });

  return {
    timestamp: Date.now(),
    meshName: 'mesh-default',
    elements: { nodes, edges }
  };
};

export const meshHandlers = [
  http.get('*/api/mesh/graph', () => {
    return HttpResponse.json(generateMeshGraphData());
  })
];
