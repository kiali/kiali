import axios, { AxiosHeaders } from 'axios';
import { config } from '../config';
import { LoginSession } from '../store/Store';
import { App, AppQuery } from '../types/App';
import { AppList, AppListQuery } from '../types/AppList';
import { AuthInfo } from '../types/Auth';
import { DurationInSeconds, HTTP_VERBS, Password, TimeInSeconds, UserName } from '../types/Common';
import { DashboardModel } from 'types/Dashboards';
import { GrafanaInfo } from '../types/GrafanaInfo';
import { GraphDefinition, GraphElementsQuery, NodeParamsType, NodeType } from '../types/Graph';
import {
  AppHealth,
  NamespaceAppHealth,
  NamespaceHealthQuery,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth,
  ServiceHealth,
  WorkloadHealth
} from '../types/Health';
import {
  IstioConfigDetails,
  IstioConfigDetailsQuery,
  IstioPermissions,
  IstioPermissionsQuery
} from '../types/IstioConfigDetails';
import { IstioConfigList, IstioConfigListQuery, IstioConfigsMapQuery } from '../types/IstioConfigList';
import {
  Pod,
  PodLogs,
  ValidationStatus,
  EnvoyProxyDump,
  VirtualService,
  DestinationRuleC,
  K8sHTTPRoute,
  OutboundTrafficPolicy,
  CanaryUpgradeStatus,
  PodLogsQuery,
  LogLevelQuery
} from '../types/IstioObjects';
import { ComponentStatus, IstiodResourceThresholds } from '../types/IstioStatus';
import { TracingInfo, TracingResponse, TracingSingleResponse } from '../types/TracingInfo';
import { MeshClusters, MeshDefinition, MeshQuery } from '../types/Mesh';
import { DashboardQuery, IstioMetricsOptions, MetricsStatsQuery } from '../types/MetricsOptions';
import { IstioMetricsMap, MetricsPerNamespace, MetricsStatsResult } from '../types/Metrics';
import { Namespace } from '../types/Namespace';
import { KialiCrippledFeatures, ServerConfig } from '../types/ServerConfig';
import { StatusState } from '../types/StatusState';
import {
  ServiceDetailsInfo,
  ServiceDetailsQuery,
  ServiceUpdateQuery,
  isServiceDetailsInfo
} from '../types/ServiceInfo';
import { ServiceList, ServiceListQuery } from '../types/ServiceList';
import { Span, TracingQuery } from 'types/Tracing';
import { TLSStatus } from '../types/TLSStatus';
import {
  Workload,
  WorkloadListQuery,
  ClusterWorkloadsResponse,
  WorkloadQuery,
  WorkloadUpdateQuery
} from '../types/Workload';
import { CertsInfo } from 'types/CertsInfo';
import { ApiError, ApiResponse } from 'types/Api';
export const ANONYMOUS_USER = 'anonymous';

interface ClusterParam {
  clusterName?: string;
}

interface BasicAuth {
  password: string;
  username: string;
}

type LoginRequest = BasicAuth & {
  token: Password;
};

interface Namespaces {
  namespaces: string;
}

type QueryParams<T> = T & ClusterParam;

/**
 * Some platforms defines a proxy to the internal Kiali backend (like Openshift Console)
 * https://github.com/openshift/enhancements/blob/master/enhancements/console/dynamic-plugins.md#delivering-plugins
 * API Proxy defined by the platform is added before url request
 * This environment variable is not defined in standalone Kiali application
 */
const apiProxy = process.env.API_PROXY ?? null;

/** API URLs */

const urls = config.api.urls;

/**  Headers Definitions */

const loginHeaders = config.login.headers;

/**  Helpers to Requests */

const getHeaders = (urlEncoded?: boolean): Partial<AxiosHeaders> => {
  if (apiProxy || urlEncoded) {
    return { 'Content-Type': 'application/x-www-form-urlencoded', ...loginHeaders };
  }
  return { 'Content-Type': 'application/json', ...loginHeaders };
};

const basicAuth = (username: UserName, password: Password): BasicAuth => {
  return { username: username, password: password };
};

const newRequest = <P>(
  method: HTTP_VERBS,
  url: string,
  queryParams: unknown,
  data: unknown
): Promise<ApiResponse<P>> => {
  return axios.request<P>({
    method: method,
    url: apiProxy ? `${apiProxy}/${url}` : url,
    data: apiProxy ? JSON.stringify(data) : data,
    headers: getHeaders() as AxiosHeaders,
    params: queryParams
  });
};

/** Requests */
export const extendSession = (): Promise<ApiResponse<LoginSession>> => {
  return newRequest<LoginSession>(HTTP_VERBS.GET, urls.authenticate, {}, {});
};

export const login = async (
  request: LoginRequest = { username: ANONYMOUS_USER, password: 'anonymous', token: '' }
): Promise<ApiResponse<LoginSession>> => {
  const params = new URLSearchParams();
  params.append('token', request.token);

  const axiosRequest = {
    method: HTTP_VERBS.POST,
    url: apiProxy ? `${apiProxy}/${urls.authenticate}` : urls.authenticate,
    headers: getHeaders(true) as AxiosHeaders,
    data: params
  };

  if (request.username !== '' || request.password !== '') {
    axiosRequest['auth'] = basicAuth(request.username, request.password);
  }

  return axios(axiosRequest);
};

export const logout = (): Promise<ApiResponse<void>> => {
  return newRequest<void>(HTTP_VERBS.GET, urls.logout, {}, {});
};

export const getAuthInfo = async (): Promise<ApiResponse<AuthInfo>> => {
  return newRequest<AuthInfo>(HTTP_VERBS.GET, urls.authInfo, {}, {});
};

export const checkOpenshiftAuth = async (data: string): Promise<ApiResponse<LoginSession>> => {
  return axios.request<LoginSession>({
    method: HTTP_VERBS.POST,
    url: urls.authenticate,
    data: data,
    headers: getHeaders(true) as AxiosHeaders,
    params: {}
  });
};

export const getStatus = (): Promise<ApiResponse<StatusState>> => {
  return newRequest<StatusState>(HTTP_VERBS.GET, urls.status, {}, {});
};

export const getNamespaces = (): Promise<ApiResponse<Namespace[]>> => {
  return newRequest<Namespace[]>(HTTP_VERBS.GET, urls.namespaces, {}, {});
};

export const getNamespaceInfo = (namespace: string, cluster?: string): Promise<ApiResponse<Namespace>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Namespace>(HTTP_VERBS.GET, urls.namespaceInfo(namespace), queryParams, {});
};

export const getNamespaceMetrics = (
  namespace: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<Readonly<IstioMetricsMap>>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Readonly<IstioMetricsMap>>(HTTP_VERBS.GET, urls.namespaceMetrics(namespace), queryParams, {});
};

// comma separated list of namespaces
export const getClustersMetrics = (
  namespaces: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<MetricsPerNamespace>> => {
  const queryParams: QueryParams<IstioMetricsOptions & Namespaces> = { ...params, namespaces };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<MetricsPerNamespace>(HTTP_VERBS.GET, urls.clustersMetrics(), queryParams, {});
};

export const getMeshTls = (cluster?: string): Promise<ApiResponse<TLSStatus>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.meshTls(), queryParams, {});
};

export const getOutboundTrafficPolicyMode = (): Promise<ApiResponse<OutboundTrafficPolicy>> => {
  return newRequest<OutboundTrafficPolicy>(HTTP_VERBS.GET, urls.outboundTrafficPolicyMode(), {}, {});
};

export const getIstioStatus = (cluster?: string): Promise<ApiResponse<ComponentStatus[]>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<ComponentStatus[]>(HTTP_VERBS.GET, urls.istioStatus(), queryParams, {});
};

export const getIstioCertsInfo = (): Promise<ApiResponse<CertsInfo[]>> => {
  return newRequest<CertsInfo[]>(HTTP_VERBS.GET, urls.istioCertsInfo(), {}, {});
};

export const getIstiodResourceThresholds = (): Promise<ApiResponse<IstiodResourceThresholds>> => {
  return newRequest<IstiodResourceThresholds>(HTTP_VERBS.GET, urls.istiodResourceThresholds(), {}, {});
};

export const getNamespaceTls = (namespace: string, cluster?: string): Promise<ApiResponse<TLSStatus>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.namespaceTls(namespace), queryParams, {});
};

export const getNamespaceValidations = (
  namespace: string,
  cluster?: string
): Promise<ApiResponse<ValidationStatus>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<ValidationStatus>(HTTP_VERBS.GET, urls.namespaceValidations(namespace), queryParams, {});
};

export const updateNamespace = (
  namespace: string,
  jsonPatch: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest(HTTP_VERBS.PATCH, urls.namespace(namespace), queryParams, jsonPatch);
};

export const getIstioConfig = (
  namespace: string,
  objects: string[],
  validate: boolean,
  labelSelector: string,
  workloadSelector: string,
  cluster?: string
): Promise<ApiResponse<IstioConfigList>> => {
  const params: QueryParams<IstioConfigListQuery> = {};

  if (objects && objects.length > 0) {
    params.objects = objects.join(',');
  }

  if (validate) {
    params.validate = validate;
  }

  if (labelSelector) {
    params.labelSelector = labelSelector;
  }

  if (workloadSelector) {
    params.workloadSelector = workloadSelector;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<IstioConfigList>(HTTP_VERBS.GET, urls.istioConfig(namespace), params, {});
};

export const getAllIstioConfigs = (
  objects: string[],
  validate: boolean,
  labelSelector: string,
  workloadSelector: string,
  cluster?: string
): Promise<ApiResponse<IstioConfigList>> => {
  const params: QueryParams<IstioConfigsMapQuery> = {};

  if (objects && objects.length > 0) {
    params.objects = objects.join(',');
  }

  if (validate) {
    params.validate = validate;
  }

  if (labelSelector) {
    params.labelSelector = labelSelector;
  }

  if (workloadSelector) {
    params.workloadSelector = workloadSelector;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<IstioConfigList>(HTTP_VERBS.GET, urls.allIstioConfigs(), params, {});
};

export const getIstioConfigDetail = (
  namespace: string,
  objectType: string,
  object: string,
  validate: boolean,
  cluster?: string
): Promise<ApiResponse<IstioConfigDetails>> => {
  const queryParams: QueryParams<IstioConfigDetailsQuery> = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  if (validate) {
    queryParams.validate = true;
    queryParams.help = true;
  }

  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetail(namespace, objectType, object),
    queryParams,
    {}
  );
};

export const deleteIstioConfigDetail = (
  namespace: string,
  objectType: string,
  object: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<string>(HTTP_VERBS.DELETE, urls.istioConfigDelete(namespace, objectType, object), queryParams, {});
};

export const updateIstioConfigDetail = (
  namespace: string,
  objectType: string,
  object: string,
  jsonPatch: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest(HTTP_VERBS.PATCH, urls.istioConfigUpdate(namespace, objectType, object), queryParams, jsonPatch);
};

export const createIstioConfigDetail = (
  namespace: string,
  objectType: string,
  json: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const queryParams: ClusterParam = {};

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest(HTTP_VERBS.POST, urls.istioConfigCreate(namespace, objectType), queryParams, json);
};

// comma separated list of namespaces
export const getConfigValidations = (
  namespaces: string,
  cluster?: string
): Promise<ApiResponse<[ValidationStatus]>> => {
  const queryParams: QueryParams<Namespaces> = {
    namespaces: namespaces
  };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<[ValidationStatus]>(HTTP_VERBS.GET, urls.configValidations(), queryParams, {});
};

// comma separated list of namespaces
export const getClustersTls = (namespaces: string, cluster?: string): Promise<ApiResponse<[TLSStatus]>> => {
  const queryParams: QueryParams<Namespaces> = {
    namespaces: namespaces
  };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<[TLSStatus]>(HTTP_VERBS.GET, urls.clustersTls(), queryParams, {});
};

export const getClustersServices = (
  namespaces: string,
  params: ServiceListQuery,
  cluster?: string
): Promise<ApiResponse<ServiceList>> => {
  const queryParams: QueryParams<ServiceListQuery & Namespaces> = {
    ...params,
    namespaces: namespaces
  };

  if (cluster) {
    queryParams.clusterName = cluster;
  }
  return newRequest<ServiceList>(HTTP_VERBS.GET, urls.clustersServices(), queryParams, {});
};

export const getServiceMetrics = (
  namespace: string,
  service: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<IstioMetricsMap>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.serviceMetrics(namespace, service), queryParams, {});
};

export const getServiceDashboard = (
  namespace: string,
  service: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<DashboardModel>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.serviceDashboard(namespace, service), queryParams, {});
};

export const getAggregateMetrics = (
  namespace: string,
  aggregate: string,
  aggregateValue: string,
  params: IstioMetricsOptions
): Promise<ApiResponse<IstioMetricsMap>> => {
  return newRequest<IstioMetricsMap>(
    HTTP_VERBS.GET,
    urls.aggregateMetrics(namespace, aggregate, aggregateValue),
    params,
    {}
  );
};

export const getApp = (
  namespace: string,
  app: string,
  params: AppQuery,
  cluster?: string
): Promise<ApiResponse<App>> => {
  const queryParams: QueryParams<AppQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<App>(HTTP_VERBS.GET, urls.app(namespace, app), queryParams, {});
};

export const getClustersApps = (
  namespaces: string,
  params: AppListQuery,
  cluster?: string
): Promise<ApiResponse<AppList>> => {
  const queryParams: QueryParams<AppListQuery & Namespaces> = {
    ...params,
    namespaces: namespaces
  };

  if (cluster) {
    queryParams.clusterName = cluster;
  }
  return newRequest<AppList>(HTTP_VERBS.GET, urls.clustersApps(), queryParams, {});
};

export const getAppMetrics = (
  namespace: string,
  app: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<IstioMetricsMap>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.appMetrics(namespace, app), queryParams, {});
};

export const getAppDashboard = (
  namespace: string,
  app: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<DashboardModel>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.appDashboard(namespace, app), queryParams, {});
};

export const getWorkloadMetrics = (
  namespace: string,
  workload: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<IstioMetricsMap>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.workloadMetrics(namespace, workload), queryParams, {});
};

export const getWorkloadDashboard = (
  namespace: string,
  workload: string,
  params: IstioMetricsOptions,
  cluster?: string
): Promise<ApiResponse<DashboardModel>> => {
  const queryParams: QueryParams<IstioMetricsOptions> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.workloadDashboard(namespace, workload), queryParams, {});
};

export const getCustomDashboard = (
  ns: string,
  tpl: string,
  params: DashboardQuery,
  cluster?: string
): Promise<ApiResponse<DashboardModel>> => {
  const queryParams: QueryParams<DashboardQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.customDashboard(ns, tpl), queryParams, {});
};

export const getClustersAppHealth = async (
  namespaces: string,
  duration: DurationInSeconds,
  cluster?: string,
  queryTime?: TimeInSeconds
): Promise<Map<string, NamespaceAppHealth>> => {
  const params: QueryParams<NamespaceHealthQuery & Namespaces> = {
    type: 'app',
    namespaces: namespaces
  };

  if (duration) {
    params.rateInterval = `${String(duration)}s`;
  }

  if (queryTime) {
    params.queryTime = String(queryTime);
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<Map<string, NamespaceAppHealth>>(HTTP_VERBS.GET, urls.clustersHealth(), params, {}).then(
    response => {
      const ret = new Map<string, NamespaceAppHealth>();
      const namespaceAppHealth = response.data['namespaceAppHealth'];
      if (namespaceAppHealth) {
        Object.keys(namespaceAppHealth).forEach(ns => {
          if (!ret[ns]) {
            ret[ns] = {};
          }
          Object.keys(namespaceAppHealth[ns]).forEach(k => {
            if (namespaceAppHealth[ns][k]) {
              const ah = AppHealth.fromJson(namespaces, k, namespaceAppHealth[ns][k], {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              });

              ret[ns][k] = ah;
            }
          });
        });
      }
      return ret;
    }
  );
};

export const getClustersServiceHealth = async (
  namespaces: string,
  duration: DurationInSeconds,
  cluster?: string,
  queryTime?: TimeInSeconds
): Promise<Map<string, NamespaceServiceHealth>> => {
  const params: QueryParams<NamespaceHealthQuery & Namespaces> = {
    type: 'service',
    namespaces: namespaces
  };

  if (duration) {
    params.rateInterval = `${String(duration)}s`;
  }

  if (queryTime) {
    params.queryTime = String(queryTime);
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<Map<string, NamespaceServiceHealth>>(HTTP_VERBS.GET, urls.clustersHealth(), params, {}).then(
    response => {
      const ret = new Map<string, NamespaceServiceHealth>();

      const namespaceServiceHealth = response.data['namespaceServiceHealth'];
      if (namespaceServiceHealth) {
        Object.keys(namespaceServiceHealth).forEach(ns => {
          if (!ret[ns]) {
            ret[ns] = {};
          }
          Object.keys(namespaceServiceHealth[ns]).forEach(k => {
            if (namespaceServiceHealth[ns][k]) {
              const sh = ServiceHealth.fromJson(namespaces, k, namespaceServiceHealth[ns][k], {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              });

              ret[ns][k] = sh;
            }
          });
        });
      }
      return ret;
    }
  );
};

export const getClustersWorkloadHealth = async (
  namespaces: string,
  duration: DurationInSeconds,
  cluster?: string,
  queryTime?: TimeInSeconds
): Promise<Map<string, NamespaceWorkloadHealth>> => {
  const params: QueryParams<NamespaceHealthQuery & Namespaces> = {
    type: 'workload',
    namespaces: namespaces
  };

  if (duration) {
    params.rateInterval = `${String(duration)}s`;
  }
  if (queryTime) {
    params.queryTime = String(queryTime);
  }
  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<Map<string, NamespaceWorkloadHealth>>(HTTP_VERBS.GET, urls.clustersHealth(), params, {}).then(
    response => {
      const ret = new Map<string, NamespaceWorkloadHealth>();

      const namespaceWorkloadHealth = response.data['namespaceWorkloadHealth'];
      if (namespaceWorkloadHealth) {
        Object.keys(namespaceWorkloadHealth).forEach(ns => {
          if (!ret[ns]) {
            ret[ns] = {};
          }
          Object.keys(namespaceWorkloadHealth[ns]).forEach(k => {
            if (namespaceWorkloadHealth[ns][k]) {
              const wh = WorkloadHealth.fromJson(namespaces, k, namespaceWorkloadHealth[ns][k], {
                rateInterval: duration,
                hasSidecar: true,
                hasAmbient: false
              });

              ret[ns][k] = wh;
            }
          });
        });
      }
      return ret;
    }
  );
};

export const getGrafanaInfo = (): Promise<ApiResponse<GrafanaInfo>> => {
  return newRequest<GrafanaInfo>(HTTP_VERBS.GET, urls.grafana, {}, {});
};

export const getTracingInfo = (): Promise<ApiResponse<TracingInfo>> => {
  return newRequest<TracingInfo>(HTTP_VERBS.GET, urls.tracing, {}, {});
};

export const getAppTraces = (
  namespace: string,
  app: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<TracingResponse>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<TracingResponse>(HTTP_VERBS.GET, urls.appTraces(namespace, app), queryParams, {});
};

export const getServiceTraces = (
  namespace: string,
  service: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<TracingResponse>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<TracingResponse>(HTTP_VERBS.GET, urls.serviceTraces(namespace, service), queryParams, {});
};

export const getWorkloadTraces = (
  namespace: string,
  workload: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<TracingResponse>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<TracingResponse>(HTTP_VERBS.GET, urls.workloadTraces(namespace, workload), queryParams, {});
};

export const getErrorTraces = (
  namespace: string,
  service: string,
  duration: DurationInSeconds
): Promise<ApiResponse<number>> => {
  return newRequest<number>(HTTP_VERBS.GET, urls.tracingErrorTraces(namespace, service), { duration: duration }, {});
};

export const getTrace = (idTrace: string): Promise<ApiResponse<TracingSingleResponse>> => {
  return newRequest<TracingSingleResponse>(HTTP_VERBS.GET, urls.tracingTrace(idTrace), {}, {});
};

export const getGraphElements = (params: GraphElementsQuery): Promise<ApiResponse<GraphDefinition>> => {
  return newRequest<GraphDefinition>(HTTP_VERBS.GET, urls.namespacesGraphElements, params, {});
};

export const getNodeGraphElements = (
  node: NodeParamsType,
  params: GraphElementsQuery,
  cluster?: string
): Promise<ApiResponse<GraphDefinition>> => {
  const queryParams: QueryParams<GraphElementsQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  switch (node.nodeType) {
    case NodeType.AGGREGATE:
      return !node.service
        ? newRequest<GraphDefinition>(
            HTTP_VERBS.GET,
            urls.aggregateGraphElements(node.namespace.name, node.aggregate!, node.aggregateValue!),
            queryParams,
            {}
          )
        : newRequest<GraphDefinition>(
            HTTP_VERBS.GET,
            urls.aggregateByServiceGraphElements(
              node.namespace.name,
              node.aggregate!,
              node.aggregateValue!,
              node.service
            ),
            queryParams,
            {}
          );
    case NodeType.APP:
    case NodeType.BOX: // we only support app box node graphs, so treat like app
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.appGraphElements(node.namespace.name, node.app, node.version),
        queryParams,
        {}
      );
    case NodeType.SERVICE:
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.serviceGraphElements(node.namespace.name, node.service),
        queryParams,
        {}
      );
    case NodeType.WORKLOAD:
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.workloadGraphElements(node.namespace.name, node.workload),
        queryParams,
        {}
      );
    default:
      // default to namespace graph
      return getGraphElements({ ...params, namespaces: node.namespace.name });
  }
};

export const getServerConfig = (): Promise<ApiResponse<ServerConfig>> => {
  return newRequest<ServerConfig>(HTTP_VERBS.GET, urls.serverConfig, {}, {});
};

export const getServiceDetail = async (
  namespace: string,
  service: string,
  validate: boolean,
  cluster?: string,
  rateInterval?: DurationInSeconds
): Promise<ServiceDetailsInfo> => {
  const params: QueryParams<ServiceDetailsQuery> = {};

  if (validate) {
    params.validate = true;
  }

  if (rateInterval) {
    params.rateInterval = `${rateInterval}s`;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<ServiceDetailsInfo>(HTTP_VERBS.GET, urls.service(namespace, service), params, {}).then(r => {
    const info: ServiceDetailsInfo = r.data;

    if (info.health) {
      // Default rate interval in backend = 600s
      info.health = ServiceHealth.fromJson(namespace, service, info.health, {
        rateInterval: rateInterval ?? 600,
        hasSidecar: info.istioSidecar,
        hasAmbient: info.istioAmbient
      });
    }

    return info;
  });
};

export const getClustersWorkloads = (
  namespaces: string,
  params: AppListQuery,
  cluster?: string
): Promise<ApiResponse<ClusterWorkloadsResponse>> => {
  const queryParams: QueryParams<WorkloadListQuery & Namespaces> = {
    ...params,
    namespaces: namespaces
  };

  if (cluster) {
    queryParams.clusterName = cluster;
  }
  return newRequest<ClusterWorkloadsResponse>(HTTP_VERBS.GET, urls.clustersWorkloads(), queryParams, {});
};

export const getWorkload = (
  namespace: string,
  name: string,
  params: WorkloadQuery,
  cluster?: string
): Promise<ApiResponse<Workload>> => {
  const queryParams: QueryParams<WorkloadQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Workload>(HTTP_VERBS.GET, urls.workload(namespace, name), queryParams, {});
};

export const updateWorkload = (
  namespace: string,
  name: string,
  type: string,
  jsonPatch: string,
  patchType?: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const params: QueryParams<WorkloadUpdateQuery> = { type: type };

  if (patchType) {
    params.patchType = patchType;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest(HTTP_VERBS.PATCH, urls.workload(namespace, name), params, jsonPatch);
};

export const updateService = (
  namespace: string,
  name: string,
  jsonPatch: string,
  patchType?: string,
  cluster?: string
): Promise<ApiResponse<string>> => {
  const params: QueryParams<ServiceUpdateQuery> = {};

  if (patchType) {
    params.patchType = patchType;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest(HTTP_VERBS.PATCH, urls.service(namespace, name), params, jsonPatch);
};

export const getPod = (namespace: string, name: string): Promise<ApiResponse<Pod>> => {
  return newRequest<Pod>(HTTP_VERBS.GET, urls.pod(namespace, name), {}, {});
};

export const getPodLogs = (
  namespace: string,
  name: string,
  container?: string,
  maxLines?: number,
  sinceTime?: number,
  duration?: DurationInSeconds,
  isProxy?: boolean,
  cluster?: string
): Promise<ApiResponse<PodLogs>> => {
  const params: QueryParams<PodLogsQuery> = {};

  if (container) {
    params.container = container;
  }

  if (sinceTime) {
    params.sinceTime = sinceTime;
  }

  if (maxLines && maxLines > 0) {
    params.maxLines = maxLines;
  }

  if (duration && duration > 0) {
    params.duration = `${duration}s`;
  }

  if (cluster) {
    params.clusterName = cluster;
  }

  params.isProxy = !!isProxy;

  return newRequest<PodLogs>(HTTP_VERBS.GET, urls.podLogs(namespace, name), params, {});
};

export const setPodEnvoyProxyLogLevel = (
  namespace: string,
  name: string,
  level: string,
  cluster?: string
): Promise<ApiResponse<void>> => {
  const params: QueryParams<LogLevelQuery> = { level: level };

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<void>(HTTP_VERBS.POST, urls.podEnvoyProxyLogging(namespace, name), params, {});
};

export const getPodEnvoyProxy = (
  namespace: string,
  pod: string,
  cluster?: string
): Promise<ApiResponse<EnvoyProxyDump>> => {
  const params: ClusterParam = {};

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<EnvoyProxyDump>(HTTP_VERBS.GET, urls.podEnvoyProxy(namespace, pod), params, {});
};

export const getPodEnvoyProxyResourceEntries = (
  namespace: string,
  pod: string,
  resource: string,
  cluster?: string
): Promise<ApiResponse<EnvoyProxyDump>> => {
  const params: ClusterParam = {};

  if (cluster) {
    params.clusterName = cluster;
  }

  return newRequest<EnvoyProxyDump>(
    HTTP_VERBS.GET,
    urls.podEnvoyProxyResourceEntries(namespace, pod, resource),
    params,
    {}
  );
};

export const getErrorString = (error: ApiError): string => {
  if (error && error.response) {
    if (error.response.data && error.response.data.error) {
      return error.response.data.error;
    }

    if (error.response.statusText) {
      let errorString = error.response.statusText;

      if (error.response.status === 401) {
        errorString += ': Has your session expired? Try logging in again.';
      }

      return errorString;
    }
  }

  return '';
};

export const getErrorDetail = (error: ApiError): string => {
  if (error && error.response) {
    if (error.response.data && error.response.data.detail) {
      return error.response.data.detail;
    }
  }

  return '';
};

export const getAppSpans = (
  namespace: string,
  app: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<Span[]>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Span[]>(HTTP_VERBS.GET, urls.appSpans(namespace, app), queryParams, {});
};

export const getServiceSpans = (
  namespace: string,
  service: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<Span[]>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Span[]>(HTTP_VERBS.GET, urls.serviceSpans(namespace, service), queryParams, {});
};

export const getWorkloadSpans = (
  namespace: string,
  workload: string,
  params: TracingQuery,
  cluster?: string
): Promise<ApiResponse<Span[]>> => {
  const queryParams: QueryParams<TracingQuery> = { ...params };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<Span[]>(HTTP_VERBS.GET, urls.workloadSpans(namespace, workload), queryParams, {});
};

export const getIstioPermissions = (namespaces: string[], cluster?: string): Promise<ApiResponse<IstioPermissions>> => {
  const queryParams: QueryParams<IstioPermissionsQuery> = { namespaces: namespaces.join(',') };

  if (cluster) {
    queryParams.clusterName = cluster;
  }

  return newRequest<IstioPermissions>(HTTP_VERBS.GET, urls.istioPermissions, queryParams, {});
};

export const getMetricsStats = (queries: MetricsStatsQuery[]): Promise<ApiResponse<MetricsStatsResult>> => {
  return newRequest<MetricsStatsResult>(HTTP_VERBS.POST, urls.metricsStats, {}, { queries: queries });
};

export const getClusters = (): Promise<ApiResponse<MeshClusters>> => {
  return newRequest<MeshClusters>(HTTP_VERBS.GET, urls.clusters, {}, {});
};

export function deleteServiceTrafficRouting(
  virtualServices: VirtualService[],
  destinationRules: DestinationRuleC[],
  k8sHTTPRouteList: K8sHTTPRoute[],
  cluster?: string
): Promise<ApiResponse<string>[]>;

export function deleteServiceTrafficRouting(serviceDetail: ServiceDetailsInfo): Promise<ApiResponse<string>[]>;

export function deleteServiceTrafficRouting(
  vsOrSvc: VirtualService[] | ServiceDetailsInfo,
  destinationRules?: DestinationRuleC[],
  k8sHTTPRouteList?: K8sHTTPRoute[],
  cluster?: string
): Promise<ApiResponse<string>[]> {
  let vsList: VirtualService[];
  let drList: DestinationRuleC[];
  let routeList: K8sHTTPRoute[];
  const deletePromises: Promise<ApiResponse<string>>[] = [];

  if (isServiceDetailsInfo(vsOrSvc)) {
    if (!cluster) {
      cluster = (vsOrSvc as ServiceDetailsInfo).service.cluster;
    }
  }

  if ('virtualServices' in vsOrSvc) {
    vsList = vsOrSvc.virtualServices;
    drList = DestinationRuleC.fromDrArray(vsOrSvc.destinationRules);
    routeList = vsOrSvc.k8sHTTPRoutes ?? [];
  } else {
    vsList = vsOrSvc;
    drList = destinationRules ?? [];
    routeList = k8sHTTPRouteList ?? [];
  }

  vsList.forEach(vs => {
    deletePromises.push(
      deleteIstioConfigDetail(vs.metadata.namespace ?? '', 'virtualservices', vs.metadata.name, cluster)
    );
  });

  routeList.forEach(k8sr => {
    deletePromises.push(
      deleteIstioConfigDetail(k8sr.metadata.namespace ?? '', 'k8shttproutes', k8sr.metadata.name, cluster)
    );
  });

  drList.forEach(dr => {
    deletePromises.push(
      deleteIstioConfigDetail(dr.metadata.namespace ?? '', 'destinationrules', dr.metadata.name, cluster)
    );

    const paName = dr.hasPeerAuthentication();
    if (!!paName) {
      deletePromises.push(deleteIstioConfigDetail(dr.metadata.namespace ?? '', 'peerauthentications', paName, cluster));
    }
  });

  return Promise.all(deletePromises);
}

export const getCrippledFeatures = (): Promise<ApiResponse<KialiCrippledFeatures>> => {
  return newRequest<KialiCrippledFeatures>(HTTP_VERBS.GET, urls.crippledFeatures, {}, {});
};

export const getCanaryUpgradeStatus = (): Promise<ApiResponse<CanaryUpgradeStatus>> => {
  return newRequest<CanaryUpgradeStatus>(HTTP_VERBS.GET, urls.canaryUpgradeStatus(), {}, {});
};

export const getMeshGraph = (params: MeshQuery): Promise<ApiResponse<MeshDefinition>> => {
  return newRequest<MeshDefinition>(HTTP_VERBS.GET, urls.meshGraph, params, {});
};
