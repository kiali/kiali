import deepFreeze from 'deep-freeze';
import { UNIT_TIME, MILLISECONDS } from './types/Common';

const conf = {
  version: '0.1',
  /** Configuration related with session */
  session: {
    /** TimeOut in Minutes default 24 hours */
    sessionTimeOut: 24 * UNIT_TIME.HOUR * MILLISECONDS,
    /** Extended Session in Minutes default 30 minutes */
    extendedSessionTimeOut: 30 * UNIT_TIME.MINUTE * MILLISECONDS,
    /** TimeOut Session remain for warning user default 1 minute */
    timeOutforWarningUser: 1 * UNIT_TIME.MINUTE * MILLISECONDS
  },
  /** Toolbar Configuration */
  toolbar: {
    /** Duration default in 1 minute */
    defaultDuration: 1 * UNIT_TIME.MINUTE,
    /** Options in interval duration */
    intervalDuration: {
      60: 'Last min',
      300: 'Last 5 min',
      600: 'Last 10 min',
      1800: 'Last 30 min',
      3600: 'Last hour',
      10800: 'Last 3 hours',
      21600: 'Last 6 hours',
      43200: 'Last 12 hours',
      86400: 'Last day',
      604800: 'Last 7 days',
      2592000: 'Last 30 days'
    },
    /** By default refresh is 15 seconds */
    defaultPollInterval: 15 * MILLISECONDS,
    /** Options in refresh */
    pollInterval: {
      0: 'Pause',
      5000: '5 sec',
      10000: '10 sec',
      15000: '15 sec',
      30000: '30 sec',
      60000: '1 min',
      300000: '5 min'
    },
    /** Graphs layouts types */
    graphLayouts: {
      cola: 'Cola',
      'cose-bilkent': 'Cose',
      dagre: 'Dagre'
    }
  },
  /** About dialog configuration */
  about: {
    project: {
      url: 'https://github.com/kiali',
      iconName: 'github',
      iconType: 'fa',
      linkText: 'Find us on GitHub'
    },
    website: {
      url: 'http://kiali.io',
      iconName: 'home',
      iconType: 'fa',
      linkText: 'Visit our web page'
    }
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
      grafana: 'api/grafana',
      istioConfig: (namespace: string) => `api/namespaces/${namespace}/istio`,
      istioConfigDetail: (namespace: string, objectType: string, object: string) =>
        `api/namespaces/${namespace}/istio/${objectType}/${object}`,
      istioConfigValidations: (namespace: string, objectType: string, object: string) =>
        `api/namespaces/${namespace}/istio/${objectType}/${object}/istio_validations`,
      jaeger: 'api/jaeger',
      namespaces: 'api/namespaces',
      namespaceGraphElements: (namespace: string) => `api/namespaces/${namespace}/graph`,
      namespaceHealth: (namespace: string) => `api/namespaces/${namespace}/health`,
      namespaceMetrics: (namespace: string) => `api/namespaces/${namespace}/metrics`,
      namespaceValidations: (namespace: string) => `api/namespaces/${namespace}/istio_validations`,
      services: (namespace: string) => `api/namespaces/${namespace}/services`,
      service: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}`,
      serviceGraphElements: (namespace: string, service: string) =>
        `api/namespaces/${namespace}/services/${service}/graph`,
      serviceHealth: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}/health`,
      serviceMetrics: (namespace: string, service: string) => `api/namespaces/${namespace}/services/${service}/metrics`,
      serviceValidations: (namespace: string, service: string) =>
        `api/namespaces/${namespace}/services/${service}/istio_validations`,
      status: 'api/status',
      token: 'api/token',
      workloads: (namespace: string) => `api/namespaces/${namespace}/workloads`,
      workload: (namespace: string, workload: string) => `api/namespaces/${namespace}/workloads/${workload}`,
      workloadGraphElements: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/graph`,
      workloadHealth: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/health`,
      workloadMetrics: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/metrics`,
      workloadValidations: (namespace: string, workload: string) =>
        `api/namespaces/${namespace}/workloads/${workload}/istio_validations`
    }
  }
};

export const config = () => {
  return deepFreeze(conf) as typeof conf;
};
