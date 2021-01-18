import axios, { AxiosError } from 'axios';

import Namespace from '../types/Namespace';
import { DashboardQuery, IstioMetricsOptions, MetricsStatsQuery } from '../types/MetricsOptions';
import { IstioMetricsMap, MetricsStatsResult } from '../types/Metrics';
import { IstioConfigDetails, IstioPermissions } from '../types/IstioConfigDetails';
import { IstioConfigList } from '../types/IstioConfigList';
import { Workload, WorkloadNamespaceResponse } from '../types/Workload';
import { ServiceDetailsInfo } from '../types/ServiceInfo';
import { JaegerInfo, JaegerResponse, JaegerSingleResponse } from '../types/JaegerInfo';
import { LoginSession } from '../store/Store';
import {
  AppHealth,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth,
  ServiceHealth,
  WorkloadHealth
} from '../types/Health';
import { App } from '../types/App';
import { ServerStatus } from '../types/ServerStatus';
import { AppList } from '../types/AppList';
import { AuthInfo } from '../types/Auth';
import { DurationInSeconds, HTTP_VERBS, Password, UserName } from '../types/Common';
import { GraphDefinition, NodeParamsType, NodeType } from '../types/Graph';
import { ServiceList } from '../types/ServiceList';
import { config } from '../config';
import { ServerConfig } from '../types/ServerConfig';
import { TLSStatus } from '../types/TLSStatus';
import { EnvoyProxyDump, Pod, PodLogs, ValidationStatus } from '../types/IstioObjects';
import { GrafanaInfo } from '../types/GrafanaInfo';
import { Span, TracingQuery } from 'types/Tracing';
import { ExperimentSpec, Iter8ExpDetailsInfo, Iter8Experiment, Iter8Info } from '../types/Iter8';
import { ComponentStatus } from '../types/IstioStatus';
import { DashboardModel } from 'types/Dashboards';

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
const getHeadersWithMethod = (method) => {
  var allHeaders = getHeaders();
  if (method === HTTP_VERBS.PATCH) {
    allHeaders["Content-Type"] = "application/json";
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
  return newRequest<ServerStatus>(HTTP_VERBS.GET, urls.status, {}, {});
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

export const getIstioStatus = () => {
  return newRequest<ComponentStatus[]>(HTTP_VERBS.GET, urls.istioStatus(), {}, {});
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
) => {
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

export const getIstioConfigDetail = (namespace: string, objectType: string, object: string, validate: boolean) => {
  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetail(namespace, objectType, object),
    validate ? { validate: true } : {},
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

export const getServices = (namespace: string) => {
  return newRequest<ServiceList>(HTTP_VERBS.GET, urls.services(namespace), {}, {});
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

export const getApp = (namespace: string, app: string) => {
  return newRequest<App>(HTTP_VERBS.GET, urls.app(namespace, app), {}, {});
};

export const getApps = (namespace: string) => {
  return newRequest<AppList>(HTTP_VERBS.GET, urls.apps(namespace), {}, {});
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

export const getServiceHealth = (
  namespace: string,
  service: string,
  durationSec: number,
  hasSidecar: boolean
): Promise<ServiceHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.serviceHealth(namespace, service), params, {}).then(response =>
    ServiceHealth.fromJson(namespace, service, response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
  );
};

export const getAppHealth = (
  namespace: string,
  app: string,
  durationSec: number,
  hasSidecar: boolean
): Promise<AppHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.appHealth(namespace, app), params, {}).then(response =>
    AppHealth.fromJson(namespace, app, response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
  );
};

export const getWorkloadHealth = (
  namespace: string,
  workload: string,
  workloadType: string,
  durationSec: number,
  hasSidecar: boolean
): Promise<WorkloadHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  params['type'] = workloadType;
  return newRequest(HTTP_VERBS.GET, urls.workloadHealth(namespace, workload), params, {}).then(response =>
    WorkloadHealth.fromJson(namespace, workload, response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
  );
};

export const getNamespaceAppHealth = (namespace: string, durationSec: number): Promise<NamespaceAppHealth> => {
  const params: any = {
    type: 'app'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest<NamespaceAppHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(response => {
    const ret: NamespaceAppHealth = {};
    Object.keys(response.data).forEach(k => {
      ret[k] = AppHealth.fromJson(namespace, k, response.data[k], { rateInterval: durationSec, hasSidecar: true });
    });
    return ret;
  });
};

export const getNamespaceServiceHealth = (namespace: string, durationSec: number): Promise<NamespaceServiceHealth> => {
  const params: any = {
    type: 'service'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest<NamespaceServiceHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(
    response => {
      const ret: NamespaceServiceHealth = {};
      Object.keys(response.data).forEach(k => {
        ret[k] = ServiceHealth.fromJson(namespace, k, response.data[k], {
          rateInterval: durationSec,
          hasSidecar: true
        });
      });
      return ret;
    }
  );
};

export const getNamespaceWorkloadHealth = (
  namespace: string,
  durationSec: number
): Promise<NamespaceWorkloadHealth> => {
  const params: any = {
    type: 'workload'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest<NamespaceWorkloadHealth>(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}).then(
    response => {
      const ret: NamespaceWorkloadHealth = {};
      Object.keys(response.data).forEach(k => {
        ret[k] = WorkloadHealth.fromJson(namespace, k, response.data[k], {
          rateInterval: durationSec,
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

export const getWorkloads = (namespace: string) => {
  return newRequest<WorkloadNamespaceResponse>(HTTP_VERBS.GET, urls.workloads(namespace), {}, {});
};

export const getWorkload = (namespace: string, name: string) => {
  return newRequest<Workload>(HTTP_VERBS.GET, urls.workload(namespace, name), {}, {});
};

export const updateWorkload = (
  namespace: string,
  name: string,
  type: string,
  jsonPatch: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.PATCH, urls.workload(namespace, name), { type: type }, jsonPatch);
};

export const getPod = (namespace: string, name: string) => {
  return newRequest<Pod>(HTTP_VERBS.GET, urls.pod(namespace, name), {}, {});
};

export const getPodLogs = (
  namespace: string,
  name: string,
  container?: string,
  tailLines?: number,
  sinceTime?: number,
  duration?: DurationInSeconds
) => {
  const params: any = {};
  if (container) {
    params.container = container;
  }
  if (sinceTime) {
    params.sinceTime = sinceTime;
  }
  if (tailLines && tailLines > 0) {
    params.tailLines = tailLines;
  }
  if (duration && duration > 0) {
    params.duration = `${duration}s`;
  }
  return newRequest<PodLogs>(HTTP_VERBS.GET, urls.podLogs(namespace, name), params, {});
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

export const getErrorString = (error: AxiosError): string => {
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

export const getErrorDetail = (error: AxiosError): string => {
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

export const getIter8Info = () => {
  return newRequest<Iter8Info>(HTTP_VERBS.GET, urls.iter8, {}, {});
};

export const getIter8Metrics = () => {
  return newRequest<string[]>(HTTP_VERBS.GET, urls.iter8Metrics, {}, {});
};

export const getExperiments = (namespaces: string[]) => {
  return newRequest<Iter8Experiment[]>(HTTP_VERBS.GET, urls.iter8Experiments, { namespaces: namespaces.join(',') }, {});
};

export const getExperimentsByNamespace = (namespace: string) => {
  return newRequest<Iter8Experiment>(HTTP_VERBS.GET, urls.iter8ExperimentsByNamespace(namespace), {}, {});
};

export const getExperiment = (namespace: string, name: string) => {
  return newRequest<Iter8ExpDetailsInfo>(HTTP_VERBS.GET, urls.iter8Experiment(namespace, name), {}, {});
};

export const getExperimentYAML = (namespace: string, name: string) => {
  return newRequest<ExperimentSpec>(HTTP_VERBS.GET, urls.iter8ExperimentYAML(namespace, name), {}, {});
};

export const deleteExperiment = (namespace: string, name: string) => {
  return newRequest<Iter8Experiment>(HTTP_VERBS.DELETE, urls.iter8Experiment(namespace, name), {}, {});
};

export const createExperiment = (namespace: string, specBody: string, params) => {
  return newRequest<string>(HTTP_VERBS.POST, urls.iter8ExperimentsByNamespace(namespace), params, specBody);
};

export const updateExperiment = (namespace: string, name: string, specBody: string) => {
  return newRequest<Iter8Experiment>(HTTP_VERBS.PATCH, urls.iter8Experiment(namespace, name), {}, specBody);
};

export const getMetricsStats = (queries: MetricsStatsQuery[]) => {
  return newRequest<MetricsStatsResult>(HTTP_VERBS.POST, urls.metricsStats, {}, { queries: queries });
};
