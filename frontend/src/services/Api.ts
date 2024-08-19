import { config } from '../config';
import { LoginSession } from '../store/Store';
import { App } from '../types/App';
import { AppList } from '../types/AppList';
import { AuthInfo } from '../types/Auth';
import { DurationInSeconds, HTTP_VERBS, Password, TimeInSeconds, UserName } from '../types/Common';
import { DashboardModel } from 'types/Dashboards';
import { GrafanaInfo } from '../types/GrafanaInfo';
import { GraphDefinition, NodeParamsType, NodeType } from '../types/Graph';
import {
  AppHealth,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth,
  ServiceHealth,
  WorkloadHealth
} from '../types/Health';
import { IstioConfigDetails, IstioPermissions } from '../types/IstioConfigDetails';
import { IstioConfigList, IstioConfigsMap } from '../types/IstioConfigList';
import {
  Pod,
  PodLogs,
  ValidationStatus,
  EnvoyProxyDump,
  VirtualService,
  DestinationRuleC,
  K8sHTTPRoute,
  OutboundTrafficPolicy,
  CanaryUpgradeStatus
} from '../types/IstioObjects';
import { ComponentStatus, IstiodResourceThresholds } from '../types/IstioStatus';
import { JaegerInfo, JaegerResponse, JaegerSingleResponse } from '../types/JaegerInfo';
import { MeshClusters } from '../types/Mesh';
import { DashboardQuery, IstioMetricsOptions, MetricsStatsQuery } from '../types/MetricsOptions';
import { IstioMetricsMap, MetricsStatsResult } from '../types/Metrics';
import Namespace from '../types/Namespace';
import { KialiCrippledFeatures, ServerConfig } from '../types/ServerConfig';
import { StatusState } from '../types/StatusState';
import { ServiceDetailsInfo } from '../types/ServiceInfo';
import { ServiceList } from '../types/ServiceList';
import { Span, TracingQuery } from 'types/Tracing';
import { TLSStatus } from '../types/TLSStatus';
import { Workload, WorkloadNamespaceResponse } from '../types/Workload';
import { CertsInfo } from 'types/CertsInfo';
import axios from "axios";
import {ApiError} from "../types/Api";
export const ANONYMOUS_USER = 'anonymous';

export interface Response<T> {
  data: T;
}

/** API URLs */

const urls = config.api.urls;

/**  Headers Definitions */

const loginHeaders = config.login.headers;

/**  Helpers to Requests */

const getHeaders = () => {
  return { ...loginHeaders };
};

/** Create content type correctly for a given request type */
const getHeadersWithMethod = method => {
  var allHeaders = getHeaders();
  if (method === HTTP_VERBS.PATCH) {
    allHeaders['Content-Type'] = 'application/json';
  }

  return allHeaders;
};

const basicAuth = (username: UserName, password: Password) => {
  return { username: username, password: password };
};

const newRequest = <P>(method: HTTP_VERBS, url: string, queryParams: any, data: any) =>
  axios.request<P>({
    method: method,
    url: url,
    data: data,
    headers: getHeadersWithMethod(method),
    params: queryParams
  });

interface LoginRequest {
  username: UserName;
  password: Password;
  token: Password;
}

/** Requests */
export const extendSession = () => {
  return newRequest<LoginSession>(HTTP_VERBS.GET, urls.authenticate, {}, {});
};

export const login = async (
  request: LoginRequest = { username: ANONYMOUS_USER, password: 'anonymous', token: '' }
): Promise<Response<LoginSession>> => {
  const params = new URLSearchParams();
  params.append('token', request.token);

  return axios({
    method: HTTP_VERBS.POST,
    url: urls.authenticate,
    headers: getHeaders(),
    auth: basicAuth(request.username, request.password),
    data: params
  });
};

export const logout = () => {
  return newRequest<undefined>(HTTP_VERBS.GET, urls.logout, {}, {});
};

export const getAuthInfo = async () => {
  return newRequest<AuthInfo>(HTTP_VERBS.GET, urls.authInfo, {}, {});
};

export const checkOpenshiftAuth = async (data: any): Promise<Response<LoginSession>> => {
  return newRequest<LoginSession>(HTTP_VERBS.POST, urls.authenticate, {}, data);
};

export const getStatus = () => {
  return newRequest<StatusState>(HTTP_VERBS.GET, urls.status, {}, {});
};

export const getNamespaces = () => {
  return newRequest<Namespace[]>(HTTP_VERBS.GET, urls.namespaces, {}, {});
};

export const getNamespaceMetrics = (namespace: string, params: IstioMetricsOptions) => {
  return newRequest<Readonly<IstioMetricsMap>>(HTTP_VERBS.GET, urls.namespaceMetrics(namespace), params, {});
};

export const getMeshTls = () => {
  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.meshTls(), {}, {});
};

export const getOutboundTrafficPolicyMode = () => {
  return newRequest<OutboundTrafficPolicy>(HTTP_VERBS.GET, urls.outboundTrafficPolicyMode(), {}, {});
};

export const getIstioStatus = () => {
  return newRequest<ComponentStatus[]>(HTTP_VERBS.GET, urls.istioStatus(), {}, {});
};

export const getIstioCertsInfo = () => {
  return newRequest<CertsInfo[]>(HTTP_VERBS.GET, urls.istioCertsInfo(), {}, {});
};

export const getIstiodResourceThresholds = () => {
  return newRequest<IstiodResourceThresholds>(HTTP_VERBS.GET, urls.istiodResourceThresholds(), {}, {});
};

export const getNamespaceTls = (namespace: string) => {
  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.namespaceTls(namespace), {}, {});
};

export const getNamespaceValidations = (namespace: string) => {
  return newRequest<ValidationStatus>(HTTP_VERBS.GET, urls.namespaceValidations(namespace), {}, {});
};

export const updateNamespace = (namespace: string, jsonPatch: string): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.PATCH, urls.namespace(namespace), {}, jsonPatch);
};

export const getIstioConfig = (
  namespace: string,
  objects: string[],
  validate: boolean,
  labelSelector: string,
  workloadSelector: string
): Promise<Response<IstioConfigList>> => {
  const params: any = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  if (validate) {
    params.validate = validate;
  }
  if (labelSelector) {
    params.labelSelector = labelSelector;
  }
  if (workloadSelector) {
    params.workloadSelector = workloadSelector;
  }
  return newRequest<IstioConfigList>(HTTP_VERBS.GET, urls.istioConfig(namespace), params, {});
};

export const getAllIstioConfigs = (
  namespaces: string[],
  objects: string[],
  validate: boolean,
  labelSelector: string,
  workloadSelector: string
): Promise<Response<IstioConfigsMap>> => {
  const params: any = namespaces && namespaces.length > 0 ? { namespaces: namespaces.join(',') } : {};
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
  return newRequest<IstioConfigsMap>(HTTP_VERBS.GET, urls.allIstioConfigs(), params, {});
};

export const getIstioConfigDetail = (namespace: string, objectType: string, object: string, validate: boolean) => {
  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetail(namespace, objectType, object),
    validate ? { validate: true, help: true } : {},
    {}
  );
};

export const deleteIstioConfigDetail = (namespace: string, objectType: string, object: string) => {
  return newRequest<string>(HTTP_VERBS.DELETE, urls.istioConfigDetail(namespace, objectType, object), {}, {});
};

export const updateIstioConfigDetail = (
  namespace: string,
  objectType: string,
  object: string,
  jsonPatch: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.PATCH, urls.istioConfigDetail(namespace, objectType, object), {}, jsonPatch);
};

export const createIstioConfigDetail = (
  namespace: string,
  objectType: string,
  json: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.POST, urls.istioConfigCreate(namespace, objectType), {}, json);
};

export const getConfigValidations = (namespaces: string[]) => {
  return newRequest<ValidationStatus>(
    HTTP_VERBS.GET,
    urls.configValidations(),
    { namespaces: namespaces.join(',') },
    {}
  );
};

export const getServices = (namespace: string, params: { [key: string]: string } = {}) => {
  return newRequest<ServiceList>(HTTP_VERBS.GET, urls.services(namespace), params, {});
};

export const getServiceMetrics = (namespace: string, service: string, params: IstioMetricsOptions) => {
  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.serviceMetrics(namespace, service), params, {});
};

export const getServiceDashboard = (namespace: string, service: string, params: IstioMetricsOptions) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.serviceDashboard(namespace, service), params, {});
};

export const getAggregateMetrics = (
  namespace: string,
  aggregate: string,
  aggregateValue: string,
  params: IstioMetricsOptions
) => {
  return newRequest<IstioMetricsMap>(
    HTTP_VERBS.GET,
    urls.aggregateMetrics(namespace, aggregate, aggregateValue),
    params,
    {}
  );
};

export const getApp = (namespace: string, app: string, params?: { [key: string]: string }) => {
  return newRequest<App>(HTTP_VERBS.GET, urls.app(namespace, app), params, {});
};

export const getApps = (namespace: string, params: any = {}) => {
  return newRequest<AppList>(HTTP_VERBS.GET, urls.apps(namespace), params, {});
};

export const getAppMetrics = (namespace: string, app: string, params: IstioMetricsOptions) => {
  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.appMetrics(namespace, app), params, {});
};

export const getAppDashboard = (namespace: string, app: string, params: IstioMetricsOptions) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.appDashboard(namespace, app), params, {});
};

export const getWorkloadMetrics = (namespace: string, workload: string, params: IstioMetricsOptions) => {
  return newRequest<IstioMetricsMap>(HTTP_VERBS.GET, urls.workloadMetrics(namespace, workload), params, {});
};

export const getWorkloadDashboard = (namespace: string, workload: string, params: IstioMetricsOptions) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.workloadDashboard(namespace, workload), params, {});
};

export const getCustomDashboard = (ns: string, tpl: string, params: DashboardQuery) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.customDashboard(ns, tpl), params, {});
};

export const getNamespaceAppHealth = (
  namespace: string,
  duration: DurationInSeconds,
  queryTime?: TimeInSeconds
): Promise<NamespaceAppHealth> => {
  const params: any = {
    type: 'app'
  };
  if (duration) {
    params.rateInterval = String(duration) + 's';
  }
  if (queryTime) {
    params.queryTime = String(queryTime);
  }
  return newRequest<NamespaceAppHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(response => {
    const ret: NamespaceAppHealth = {};
    Object.keys(response.data).forEach(k => {
      ret[k] = AppHealth.fromJson(namespace, k, response.data[k], { rateInterval: duration, hasSidecar: true });
    });
    return ret;
  });
};

export const getNamespaceServiceHealth = (
  namespace: string,
  duration: DurationInSeconds,
  queryTime?: TimeInSeconds
): Promise<NamespaceServiceHealth> => {
  const params: any = {
    type: 'service'
  };
  if (duration) {
    params.rateInterval = String(duration) + 's';
  }
  if (queryTime) {
    params.queryTime = String(queryTime);
  }
  return newRequest<NamespaceServiceHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(
    response => {
      const ret: NamespaceServiceHealth = {};
      Object.keys(response.data).forEach(k => {
        ret[k] = ServiceHealth.fromJson(namespace, k, response.data[k], {
          rateInterval: duration,
          hasSidecar: true
        });
      });
      return ret;
    }
  );
};

export const getNamespaceWorkloadHealth = (
  namespace: string,
  duration: DurationInSeconds,
  queryTime?: TimeInSeconds
): Promise<NamespaceWorkloadHealth> => {
  const params: any = {
    type: 'workload'
  };
  if (duration) {
    params.rateInterval = String(duration) + 's';
  }
  if (queryTime) {
    params.queryTime = String(queryTime);
  }
  return newRequest<NamespaceWorkloadHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(
    response => {
      const ret: NamespaceWorkloadHealth = {};
      Object.keys(response.data).forEach(k => {
        ret[k] = WorkloadHealth.fromJson(namespace, k, response.data[k], {
          rateInterval: duration,
          hasSidecar: true
        });
      });
      return ret;
    }
  );
};

export const getGrafanaInfo = () => {
  return newRequest<GrafanaInfo>(HTTP_VERBS.GET, urls.grafana, {}, {});
};

export const getJaegerInfo = () => {
  return newRequest<JaegerInfo>(HTTP_VERBS.GET, urls.jaeger, {}, {});
};

export const getAppTraces = (namespace: string, app: string, params: TracingQuery) => {
  return newRequest<JaegerResponse>(HTTP_VERBS.GET, urls.appTraces(namespace, app), params, {});
};

export const getServiceTraces = (namespace: string, service: string, params: TracingQuery) => {
  return newRequest<JaegerResponse>(HTTP_VERBS.GET, urls.serviceTraces(namespace, service), params, {});
};

export const getWorkloadTraces = (namespace: string, workload: string, params: TracingQuery) => {
  return newRequest<JaegerResponse>(HTTP_VERBS.GET, urls.workloadTraces(namespace, workload), params, {});
};

export const getJaegerErrorTraces = (namespace: string, service: string, duration: DurationInSeconds) => {
  return newRequest<number>(HTTP_VERBS.GET, urls.jaegerErrorTraces(namespace, service), { duration: duration }, {});
};

export const getJaegerTrace = (idTrace: string) => {
  return newRequest<JaegerSingleResponse>(HTTP_VERBS.GET, urls.jaegerTrace(idTrace), {}, {});
};

export const getGraphElements = (params: any) => {
  return newRequest<GraphDefinition>(HTTP_VERBS.GET, urls.namespacesGraphElements, params, {});
};

export const getNodeGraphElements = (node: NodeParamsType, params: any) => {
  switch (node.nodeType) {
    case NodeType.AGGREGATE:
      return !node.service
        ? newRequest<GraphDefinition>(
            HTTP_VERBS.GET,
            urls.aggregateGraphElements(node.namespace.name, node.aggregate!, node.aggregateValue!),
            params,
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
            params,
            {}
          );
    case NodeType.APP:
    case NodeType.BOX: // we only support app box node graphs, so treat like app
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.appGraphElements(node.namespace.name, node.app, node.version),
        params,
        {}
      );
    case NodeType.SERVICE:
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.serviceGraphElements(node.namespace.name, node.service),
        params,
        {}
      );
    case NodeType.WORKLOAD:
      return newRequest<GraphDefinition>(
        HTTP_VERBS.GET,
        urls.workloadGraphElements(node.namespace.name, node.workload),
        params,
        {}
      );
    default:
      // default to namespace graph
      return getGraphElements({ namespaces: node.namespace.name, ...params });
  }
};

export const getServerConfig = () => {
  return newRequest<ServerConfig>(HTTP_VERBS.GET, urls.serverConfig, {}, {});
};

export const getServiceDetail = (
  namespace: string,
  service: string,
  validate: boolean,
  rateInterval?: DurationInSeconds
): Promise<ServiceDetailsInfo> => {
  const params: any = {};
  if (validate) {
    params.validate = true;
  }
  if (rateInterval) {
    params.rateInterval = `${rateInterval}s`;
  }
  return newRequest<ServiceDetailsInfo>(HTTP_VERBS.GET, urls.service(namespace, service), params, {}).then(r => {
    const info: ServiceDetailsInfo = r.data;
    if (info.health) {
      // Default rate interval in backend = 600s
      info.health = ServiceHealth.fromJson(namespace, service, info.health, {
        rateInterval: rateInterval || 600,
        hasSidecar: info.istioSidecar
      });
    }
    return info;
  });
};

export const getWorkloads = (namespace: string, params: { [key: string]: string } = {}) => {
  return newRequest<WorkloadNamespaceResponse>(HTTP_VERBS.GET, urls.workloads(namespace), params, {});
};

export const getWorkload = (namespace: string, name: string, params?: { [key: string]: string }) => {
  return newRequest<Workload>(HTTP_VERBS.GET, urls.workload(namespace, name), params, {});
};

export const updateWorkload = (
  namespace: string,
  name: string,
  type: string,
  jsonPatch: string,
  patchType?: string
): Promise<Response<string>> => {
  const params: any = {};
  params.type = type
  if (patchType) {
    params.patchType = patchType
  }
  return newRequest(HTTP_VERBS.PATCH, urls.workload(namespace, name), params, jsonPatch);
};

export const updateService = (
  namespace: string,
  name: string,
  jsonPatch: string,
  patchType?: string
): Promise<Response<string>> => {
  const params: any = {};
  if (patchType) {
    params.patchType = patchType
  }
  return newRequest(HTTP_VERBS.PATCH, urls.service(namespace, name), params, jsonPatch);
};

export const getPod = (namespace: string, name: string) => {
  return newRequest<Pod>(HTTP_VERBS.GET, urls.pod(namespace, name), {}, {});
};

export const getPodLogs = (
  namespace: string,
  name: string,
  container?: string,
  maxLines?: number,
  sinceTime?: number,
  duration?: DurationInSeconds,
  isProxy?: boolean
) => {
  const params: any = {};
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
  params.isProxy = !!isProxy;

  return newRequest<PodLogs>(HTTP_VERBS.GET, urls.podLogs(namespace, name), params, {});
};

export const setPodEnvoyProxyLogLevel = (namespace: string, name: string, level: string) => {
  const params: any = {};
  params.level = level;

  return newRequest<undefined>(HTTP_VERBS.POST, urls.podEnvoyProxyLogging(namespace, name), params, {});
};

export const getPodEnvoyProxy = (namespace: string, pod: string) => {
  return newRequest<EnvoyProxyDump>(HTTP_VERBS.GET, urls.podEnvoyProxy(namespace, pod), {}, {});
};

export const getPodEnvoyProxyResourceEntries = (namespace: string, pod: string, resource: string) => {
  return newRequest<EnvoyProxyDump>(
    HTTP_VERBS.GET,
    urls.podEnvoyProxyResourceEntries(namespace, pod, resource),
    {},
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

export const getAppSpans = (namespace: string, app: string, params: TracingQuery) => {
  return newRequest<Span[]>(HTTP_VERBS.GET, urls.appSpans(namespace, app), params, {});
};

export const getServiceSpans = (namespace: string, service: string, params: TracingQuery) => {
  return newRequest<Span[]>(HTTP_VERBS.GET, urls.serviceSpans(namespace, service), params, {});
};

export const getWorkloadSpans = (namespace: string, workload: string, params: TracingQuery) => {
  return newRequest<Span[]>(HTTP_VERBS.GET, urls.workloadSpans(namespace, workload), params, {});
};

export const getIstioPermissions = (namespaces: string[]) => {
  return newRequest<IstioPermissions>(HTTP_VERBS.GET, urls.istioPermissions, { namespaces: namespaces.join(',') }, {});
};

export const getMetricsStats = (queries: MetricsStatsQuery[]) => {
  return newRequest<MetricsStatsResult>(HTTP_VERBS.POST, urls.metricsStats, {}, { queries: queries });
};

export const getClusters = () => {
  return newRequest<MeshClusters>(HTTP_VERBS.GET, urls.clusters, {}, {});
};

export function deleteServiceTrafficRouting(
  virtualServices: VirtualService[],
  destinationRules: DestinationRuleC[],
  k8sHTTPRouteList: K8sHTTPRoute[]
): Promise<any>;
export function deleteServiceTrafficRouting(serviceDetail: ServiceDetailsInfo): Promise<any>;
export function deleteServiceTrafficRouting(
  vsOrSvc: VirtualService[] | ServiceDetailsInfo,
  destinationRules?: DestinationRuleC[],
  k8sHTTPRouteList?: K8sHTTPRoute[]
): Promise<any> {
  let vsList: VirtualService[];
  let drList: DestinationRuleC[];
  let routeList: K8sHTTPRoute[];
  const deletePromises: Promise<any>[] = [];

  if ('virtualServices' in vsOrSvc) {
    vsList = vsOrSvc.virtualServices;
    drList = DestinationRuleC.fromDrArray(vsOrSvc.destinationRules);
    routeList = vsOrSvc.k8sHTTPRoutes || [];
  } else {
    vsList = vsOrSvc;
    drList = destinationRules || [];
    routeList = k8sHTTPRouteList || [];
  }

  vsList.forEach(vs => {
    deletePromises.push(deleteIstioConfigDetail(vs.metadata.namespace || '', 'virtualservices', vs.metadata.name));
  });

  routeList.forEach(k8sr => {
    deletePromises.push(deleteIstioConfigDetail(k8sr.metadata.namespace || '', 'k8shttproutes', k8sr.metadata.name));
  });

  drList.forEach(dr => {
    deletePromises.push(deleteIstioConfigDetail(dr.metadata.namespace || '', 'destinationrules', dr.metadata.name));

    const paName = dr.hasPeerAuthentication();
    if (!!paName) {
      deletePromises.push(deleteIstioConfigDetail(dr.metadata.namespace || '', 'peerauthentications', paName));
    }
  });

  return Promise.all(deletePromises);
}

export const getCrippledFeatures = (): Promise<Response<KialiCrippledFeatures>> => {
  return newRequest<KialiCrippledFeatures>(HTTP_VERBS.GET, urls.crippledFeatures, {}, {});
};

export const getCanaryUpgradeStatus = () => {
  return newRequest<CanaryUpgradeStatus>(HTTP_VERBS.GET, urls.canaryUpgradeStatus(), {}, {});
};
