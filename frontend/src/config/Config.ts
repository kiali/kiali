import deepFreeze from 'deep-freeze';
import { UNIT_TIME, MILLISECONDS } from '../types/Common';
import { t } from 'utils/I18nUtils';

// We assume this is always defined in the .env file
const documentationUrl = process.env.REACT_APP_KIALI_DOC_URL!;

const conf = {
  /** Configuration related with session */
  session: {
    /** TimeOut Session remain for warning user default 1 minute */
    timeOutforWarningUser: 1 * UNIT_TIME.MINUTE * MILLISECONDS
  },
  /** Toolbar Configuration */
  toolbar: {
    /** Duration default is 1 minute */
    defaultDuration: 1 * UNIT_TIME.MINUTE,
    /** By default refresh is 1 minute */
    defaultRefreshInterval: 60 * MILLISECONDS,
    /** Time Range default is 10 minutes **/
    defaultTimeRange: {
      rangeDuration: 10 * UNIT_TIME.MINUTE
    },
    /** Options in refresh */
    refreshInterval: {
      0: t('Pause'),
      10000: t('Every 10s'),
      15000: t('Every 15s'),
      30000: t('Every 30s'),
      60000: t('Every 1m'),
      300000: t('Every 5m'),
      900000: t('Every 15m')
    },
    /** Graphs layouts types */
    graphLayouts: {
      'kiali-grid': t('Grid'),
      'kiali-concentric': t('Concentric'),
      'kiali-dagre': t('Dagre')
    }
  },
  /** About Tracing Configuration*/
  tracing: {
    configuration: {
      limitResults: {
        20: 20,
        50: 50,
        100: 100,
        200: 200,
        300: 300,
        400: 400,
        500: 500
      },
      statusCode: {
        none: t('none'),
        200: '200',
        400: '400',
        401: '401',
        403: '403',
        404: '404',
        405: '405',
        408: '408',
        500: '500',
        502: '502',
        503: '503',
        504: '504'
      }
    }
  },
  /** About dialog configuration */
  about: {
    mesh: {
      url: '/mesh',
      linkText: t('Visit the Mesh page')
    },
    project: {
      url: 'https://github.com/kiali',
      linkText: t('Kiali on GitHub')
    },
    website: {
      url: 'https://www.kiali.io', // Without www, we get an SSL error
      linkText: 'kiali.io'
    }
  },
  /** */
  documentation: {
    url: documentationUrl
  },
  /**  Login configuration */
  login: {
    headers: {
      'X-Auth-Type-Kiali-UI': '1'
    }
  },
  /** API configuration */
  api: {
    urls: {
      aggregateGraphElements: (namespace: string, aggregate: string, aggregateValue: string) =>
        `api/namespaces/${namespace}/aggregates/${aggregate}/${aggregateValue}/graph`,
      aggregateByServiceGraphElements: (
        namespace: string,
        aggregate: string,
        aggregateValue: string,
        service: string
      ) => `api/namespaces/${namespace}/aggregates/${aggregate}/${aggregateValue}/${service}/graph`,
      aggregateMetrics: (namespace: string, aggregate: string, aggregateValue: string) =>
        `api/namespaces/${namespace}/aggregates/${aggregate}/${aggregateValue}/metrics`,
      allIstioConfigs: () => `api/istio/config`,
      apps: (namespace: string) => `api/namespaces/${namespace}/apps`,
      app: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}`,
      appGraphElements: (namespace: string, app: string, version?: string) => {
        const baseUrl = `api/namespaces/${namespace}/applications/${app}`;
        const hasVersion = version && version !== 'unknown';
        const versionSuffixed = hasVersion ? `${baseUrl}/versions/${version}` : baseUrl;
        return `${versionSuffixed}/graph`;
      },
      appHealth: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/health`,
      appMetrics: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/metrics`,
      appDashboard: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/dashboard`,
      appSpans: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/spans`,
      appTraces: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/traces`,
      authenticate: 'api/authenticate',
      authInfo: 'api/auth/info',
      clustersApps: () => `api/clusters/apps`,
      clustersHealth: () => `api/clusters/health`,
      clustersMetrics: () => `api/clusters/metrics`,
      clustersServices: () => `api/clusters/services`,
      clustersTls: () => `api/clusters/tls`,
      clustersWorkloads: () => `api/clusters/workloads`,
      configValidations: () => `api/istio/validations`,
      controlPlaneMetrics: (namespace: string, controlPlane: string) =>
        `api/namespaces/${namespace}/controlplanes/${controlPlane}/metrics`,
      controlPlanes: 'api/mesh/controlplanes',
      crippledFeatures: 'api/crippled',
      customDashboard: (namespace: string, template: string) =>
        `api/namespaces/${namespace}/customdashboard/${template}`,
      grafana: 'api/grafana',
      istioConfig: (namespace: string) => `api/namespaces/${namespace}/istio`,
      istioCertsInfo: () => 'api/istio/certs',
      istioConfigCreate: (namespace: string, group: string, version: string, kind: string) =>
        `api/namespaces/${namespace}/istio/${group}/${version}/${kind}`,
      istioConfigDetail: (namespace: string, group: string, version: string, kind: string, object: string) =>
        `api/namespaces/${namespace}/istio/${group}/${version}/${kind}/${object}`,
      istioConfigDelete: (namespace: string, group: string, version: string, kind: string, object: string) =>
        `api/namespaces/${namespace}/istio/${group}/${version}/${kind}/${object}`,
      istioConfigUpdate: (namespace: string, group: string, version: string, kind: string, object: string) =>
        `api/namespaces/${namespace}/istio/${group}/${version}/${kind}/${object}`,
      istioPermissions: 'api/istio/permissions',
      istiodResourceThresholds: () => 'api/mesh/resources/thresholds',
      istioStatus: () => 'api/istio/status',
      logout: 'api/logout',
      meshGraph: 'api/mesh/graph',
      meshTls: () => 'api/mesh/tls',
      metricsStats: 'api/stats/metrics',
      namespace: (namespace: string) => `api/namespaces/${namespace}`,
      namespaceInfo: (namespace: string) => `api/namespaces/${namespace}/info`,
      namespaceMetrics: (namespace: string) => `api/namespaces/${namespace}/metrics`,
      namespaceTls: (namespace: string) => `api/namespaces/${namespace}/tls`,
      namespaceValidations: (namespace: string) => `api/namespaces/${namespace}/validations`,
      namespaces: 'api/namespaces',
      namespacesGraphElements: `api/namespaces/graph`,
      outboundTrafficPolicyMode: () => 'api/mesh/outbound_traffic_policy/mode',
      pod: (namespace: string, pod: string) => `api/namespaces/${namespace}/pods/${pod}`,
      podLogs: (namespace: string, pod: string) => `api/namespaces/${namespace}/pods/${pod}/logs`,
      podEnvoyProxy: (namespace: string, pod: string) => `api/namespaces/${namespace}/pods/${pod}/config_dump`,
      podEnvoyProxyLogging: (namespace: string, pod: string) => `api/namespaces/${namespace}/pods/${pod}/logging`,
      podEnvoyProxyResourceEntries: (namespace: string, pod: string, resource: string) =>
        `api/namespaces/${namespace}/pods/${pod}/config_dump/${resource}`,
      podZtunnelConfig: (namespace: string, pod: string) =>
        `api/namespaces/${namespace}/pods/${pod}/config_dump_ztunnel`,
      resourceUsageMetrics: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/${workload}/usage_metrics`,
      serverConfig: `api/config`,
      service: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}`,
      serviceGraphElements: (namespace: string, service: string) =>
        `api/namespaces/${namespace}/services/${service}/graph`,
      serviceHealth: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}/health`,
      serviceMetrics: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}/metrics`,
      serviceDashboard: (namespace: string, service: string) =>
        `api/namespaces/${namespace}/services/${service}/dashboard`,
      serviceSpans: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}/spans`,
      serviceTraces: (namespace: string, svc: string) => `api/namespaces/${namespace}/services/${svc}/traces`,
      status: 'api/status',
      tracing: 'api/tracing',
      tracingErrorTraces: (namespace: string, app: string) => `api/namespaces/${namespace}/apps/${app}/errortraces`,
      tracingTrace: (idTrace: string) => `api/traces/${idTrace}`,
      workloadSpans: (namespace: string, workload: string) => `api/namespaces/${namespace}/workloads/${workload}/spans`,
      workloadTraces: (namespace: string, wkd: string) => `api/namespaces/${namespace}/workloads/${wkd}/traces`,
      workload: (namespace: string, workload: string) => `api/namespaces/${namespace}/workloads/${workload}`,
      workloadGraphElements: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/graph`,
      workloadHealth: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/health`,
      workloadMetrics: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/metrics`,
      workloadDashboard: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/dashboard`,
      ztunnelDashboard: (namespace: string, controlPlane: string) =>
        `api/namespaces/${namespace}/ztunnel/${controlPlane}/dashboard`,
      ztunnelMetrics: (namespace: string, workload: string) => `api/namespaces/${namespace}/ztunnel/${workload}/metrics`
    }
  },
  /** Graph configurations */
  graph: {
    // maxHosts is the maximum number of hosts to show in the graph for
    // nodes representing Gateways, VirtualServices and ServiceEntries.
    maxHosts: 5
  }
};

export const config = deepFreeze(conf) as typeof conf;
