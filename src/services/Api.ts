import axios, { AxiosError } from 'axios';
import { DashboardModel, DashboardQuery } from 'k-charted-react';

import Namespace from '../types/Namespace';
import { IstioMetricsOptions } from '../types/MetricsOptions';
import { Metrics } from '../types/Metrics';
import { IstioConfigDetails } from '../types/IstioConfigDetails';
import { IstioConfigList } from '../types/IstioConfigList';
import { Workload, WorkloadNamespaceResponse } from '../types/Workload';
import { ServiceDetailsInfo } from '../types/ServiceInfo';
import JaegerInfo from '../types/JaegerInfo';
import { GrafanaInfo, LoginSession } from '../store/Store';
import {
  AppHealth,
  ServiceHealth,
  WorkloadHealth,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../types/Health';
import { App } from '../types/App';
import { ServerStatus } from '../types/ServerStatus';
import { AppList } from '../types/AppList';
import { AuthInfo } from '../types/Auth';
import { HTTP_VERBS, UserName, Password, DurationInSeconds } from '../types/Common';
import { NodeParamsType, NodeType, GraphDefinition } from '../types/Graph';
import { ServiceList } from '../types/ServiceList';
import { config } from '../config';
import { ServerConfig } from '../types/ServerConfig';
import { TLSStatus } from '../types/TLSStatus';
import { Pod, PodLogs } from '../types/IstioObjects';
import { ThreeScaleHandler, ThreeScaleInfo, ThreeScaleServiceRule } from '../types/ThreeScale';

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

const basicAuth = (username: UserName, password: Password) => {
  return { username: username, password: password };
};

const newRequest = <P>(method: HTTP_VERBS, url: string, queryParams: any, data: any) =>
  axios.request<P>({
    method: method,
    url: url,
    data: data,
    headers: getHeaders(),
    params: queryParams
  });

interface LoginRequest {
  username: UserName;
  password: Password;
}

/** Requests */
export const extendSession = () => {
  return newRequest<LoginSession>(HTTP_VERBS.GET, urls.authenticate, {}, {});
};

export const login = async (
  request: LoginRequest = { username: ANONYMOUS_USER, password: 'anonymous' }
): Promise<Response<LoginSession>> => {
  return axios({
    method: HTTP_VERBS.GET,
    url: urls.authenticate,
    headers: getHeaders(),
    auth: basicAuth(request.username, request.password)
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
  return newRequest<Readonly<Metrics>>(HTTP_VERBS.GET, urls.namespaceMetrics(namespace), params, {});
};

export const getMeshTls = () => {
  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.meshTls(), {}, {});
};

export const getNamespaceTls = (namespace: string) => {
  return newRequest<TLSStatus>(HTTP_VERBS.GET, urls.namespaceTls(namespace), {}, {});
};

export const getIstioConfig = (namespace: string, objects: string[], validate: boolean) => {
  const params: any = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  if (validate) {
    params.validate = validate;
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

export const getIstioConfigDetailSubtype = (
  namespace: string,
  objectType: string,
  objectSubtype: string,
  object: string
) => {
  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetailSubtype(namespace, objectType, objectSubtype, object),
    {},
    {}
  );
};

export const deleteIstioConfigDetail = (namespace: string, objectType: string, object: string) => {
  return newRequest<string>(HTTP_VERBS.DELETE, urls.istioConfigDetail(namespace, objectType, object), {}, {});
};

export const deleteIstioConfigDetailSubtype = (
  namespace: string,
  objectType: string,
  objectSubtype: string,
  object: string
) => {
  return newRequest<string>(
    HTTP_VERBS.DELETE,
    urls.istioConfigDetailSubtype(namespace, objectType, objectSubtype, object),
    {},
    {}
  );
};

export const updateIstioConfigDetail = (
  namespace: string,
  objectType: string,
  object: string,
  jsonPatch: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.PATCH, urls.istioConfigDetail(namespace, objectType, object), {}, jsonPatch);
};

export const updateIstioConfigDetailSubtype = (
  namespace: string,
  objectType: string,
  objectSubtype: string,
  object: string,
  jsonPatch: string
): Promise<Response<string>> => {
  return newRequest(
    HTTP_VERBS.PATCH,
    urls.istioConfigDetailSubtype(namespace, objectType, objectSubtype, object),
    {},
    jsonPatch
  );
};

export const createIstioConfigDetail = (
  namespace: string,
  objectType: string,
  json: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.POST, urls.istioConfigCreate(namespace, objectType), {}, json);
};

export const createIstioConfigDetailSubtype = (
  namespace: string,
  objectType: string,
  objectSubtype: string,
  json: string
): Promise<Response<string>> => {
  return newRequest(HTTP_VERBS.POST, urls.istioConfigCreateSubtype(namespace, objectType, objectSubtype), {}, json);
};

export const getServices = (namespace: string) => {
  return newRequest<ServiceList>(HTTP_VERBS.GET, urls.services(namespace), {}, {});
};

export const getServiceMetrics = (namespace: string, service: string, params: IstioMetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.serviceMetrics(namespace, service), params, {});
};

export const getServiceDashboard = (namespace: string, service: string, params: IstioMetricsOptions) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.serviceDashboard(namespace, service), params, {});
};

export const getApp = (namespace: string, app: string) => {
  return newRequest<App>(HTTP_VERBS.GET, urls.app(namespace, app), {}, {});
};

export const getApps = (namespace: string) => {
  return newRequest<AppList>(HTTP_VERBS.GET, urls.apps(namespace), {}, {});
};

export const getAppMetrics = (namespace: string, app: string, params: IstioMetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.appMetrics(namespace, app), params, {});
};

export const getAppDashboard = (namespace: string, app: string, params: IstioMetricsOptions) => {
  return newRequest<DashboardModel>(HTTP_VERBS.GET, urls.appDashboard(namespace, app), params, {});
};

export const getWorkloadMetrics = (namespace: string, workload: string, params: IstioMetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.workloadMetrics(namespace, workload), params, {});
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
    ServiceHealth.fromJson(response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
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
    AppHealth.fromJson(response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
  );
};

export const getWorkloadHealth = (
  namespace: string,
  workload: string,
  durationSec: number,
  hasSidecar: boolean
): Promise<WorkloadHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.workloadHealth(namespace, workload), params, {}).then(response =>
    WorkloadHealth.fromJson(response.data, { rateInterval: durationSec, hasSidecar: hasSidecar })
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
      ret[k] = AppHealth.fromJson(response.data[k], { rateInterval: durationSec, hasSidecar: true });
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
        ret[k] = ServiceHealth.fromJson(response.data[k], { rateInterval: durationSec, hasSidecar: true });
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
        ret[k] = WorkloadHealth.fromJson(response.data[k], { rateInterval: durationSec, hasSidecar: true });
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

export const getGraphElements = (params: any) => {
  return newRequest<GraphDefinition>(HTTP_VERBS.GET, urls.namespacesGraphElements, params, {});
};

export const getNodeGraphElements = (node: NodeParamsType, params: any) => {
  switch (node.nodeType) {
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
      info.health = ServiceHealth.fromJson(info.health, {
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

export const getPod = (namespace: string, name: string) => {
  return newRequest<Pod>(HTTP_VERBS.GET, urls.pod(namespace, name), {}, {});
};

export const getPodLogs = (
  namespace: string,
  name: string,
  container?: string,
  tailLines?: number,
  sinceTime?: number
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
  return newRequest<PodLogs>(HTTP_VERBS.GET, urls.podLogs(namespace, name), params, {});
};

export const getMessage = (type: string, msg: string, error: AxiosError) => {
  let errorMessage = msg;
  if (error && error.response) {
    if (error.response.data && error.response.data.error) {
      errorMessage = `${msg}, ${type}: [ ${error.response.data.error} ]`;
    } else if (error.response.statusText) {
      errorMessage = `${msg}, ${type}: [ ${error.response.statusText} ]`;
      if (error.response.status === 401) {
        errorMessage += ' Has your session expired? Try logging in again.';
      }
    }
  }
  return errorMessage;
};

export const getInfoMsg = (msg: string, error: AxiosError) => {
  return getMessage('Info', msg, error);
};

export const getErrorMsg = (msg: string, error: AxiosError) => {
  return getMessage('Error', msg, error);
};

export const getThreeScaleInfo = () => {
  return newRequest<ThreeScaleInfo>(HTTP_VERBS.GET, urls.threeScale, {}, {});
};

export const getThreeScaleHandlers = () => {
  return newRequest<ThreeScaleHandler[]>(HTTP_VERBS.GET, urls.threeScaleHandlers, {}, {});
};

export const createThreeScaleHandler = (json: string) => {
  return newRequest<ThreeScaleHandler[]>(HTTP_VERBS.POST, urls.threeScaleHandlers, {}, json);
};

export const updateThreeScaleHandler = (handlerName: string, json: string) => {
  return newRequest<ThreeScaleHandler[]>(HTTP_VERBS.PATCH, urls.threeScaleHandler(handlerName), {}, json);
};

export const deleteThreeScaleHandler = (handlerName: string) => {
  return newRequest<ThreeScaleHandler[]>(HTTP_VERBS.DELETE, urls.threeScaleHandler(handlerName), {}, {});
};

export const getThreeScaleServiceRule = (namespace: string, service: string) => {
  return newRequest<ThreeScaleServiceRule>(HTTP_VERBS.GET, urls.threeScaleServiceRule(namespace, service), {}, {});
};

export const createThreeScaleServiceRule = (namespace: string, json: string) => {
  return newRequest<string>(HTTP_VERBS.POST, urls.threeScaleServiceRules(namespace), {}, json);
};

export const updateThreeScaleServiceRule = (namespace: string, service: string, json: string) => {
  return newRequest<string>(HTTP_VERBS.PATCH, urls.threeScaleServiceRule(namespace, service), {}, json);
};

export const deleteThreeScaleServiceRule = (namespace: string, service: string) => {
  return newRequest<string>(HTTP_VERBS.DELETE, urls.threeScaleServiceRule(namespace, service), {}, {});
};
