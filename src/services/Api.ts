import axios, { AxiosError } from 'axios';
import Namespace from '../types/Namespace';
import MetricsOptions from '../types/MetricsOptions';
import { Metrics } from '../types/Metrics';
import { IstioConfigDetails } from '../types/IstioConfigDetails';
import { IstioConfigList } from '../types/IstioConfigList';
import { Workload, WorkloadNamespaceResponse } from '../types/Workload';
import { NamespaceValidations, Validations } from '../types/IstioObjects';
import { ServiceDetailsInfo } from '../types/ServiceInfo';
import JaegerInfo from '../types/JaegerInfo';
import { GrafanaInfo } from '../store/Store';
import {
  AppHealth,
  ServiceHealth,
  WorkloadHealth,
  NamespaceAppHealth,
  NamespaceServiceHealth,
  NamespaceWorkloadHealth
} from '../types/Health';
import { ServiceList } from '../types/ServiceList';
import { AppList } from '../types/AppList';
import { App } from '../types/App';
import { NodeParamsType, NodeType } from '../types/Graph';
import { config } from '../config';
import { AuthToken, HTTP_VERBS } from '../types/Common';
import { ServerConfig } from '../config/config';

export interface Response<T> {
  data: T;
}

/** API URLs */

const urls = config().api.urls;

/**  Headers Definitions */

const loginHeaders = config().login.headers;
const authHeader = (auth: AuthToken) => ({ Authorization: auth });

/**  Helpers to Requests */

const getHeaders = (auth?: AuthToken) => {
  if (auth === undefined) {
    return { ...loginHeaders };
  }
  return { ...loginHeaders, ...authHeader(auth) };
};

const basicAuth = (username: string, password: string) => {
  return { username: username, password: password };
};

const newRequest = <P>(method: HTTP_VERBS, url: string, queryParams: any, data: any, auth?: AuthToken) =>
  axios.request<P>({
    method: method,
    url: url,
    data: data,
    headers: getHeaders(auth),
    params: queryParams
  });

/** Requests */
export const login = (username: string, password: string) => {
  return new Promise((resolve, reject) => {
    axios({
      method: HTTP_VERBS.GET,
      url: urls.token,
      headers: getHeaders(),
      auth: basicAuth(username, password)
    })
      .then(response => {
        resolve(response);
      })
      .catch(error => {
        reject(error);
      });
  });
};

export const getStatus = () => {
  return newRequest(HTTP_VERBS.GET, urls.status, {}, {});
};

export const getNamespaces = (auth: AuthToken) => {
  return newRequest<Namespace[]>(HTTP_VERBS.GET, urls.namespaces, {}, {}, auth);
};

export const getNamespaceMetrics = (auth: AuthToken, namespace: string, params: any) => {
  return newRequest<Readonly<Metrics>>(HTTP_VERBS.GET, urls.namespaceMetrics(namespace), params, {}, auth);
};

export const getIstioConfig = (auth: AuthToken, namespace: string, objects: string[]) => {
  const params = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  return newRequest<IstioConfigList>(HTTP_VERBS.GET, urls.istioConfig(namespace), params, {}, auth);
};

export const getIstioConfigDetail = (auth: AuthToken, namespace: string, objectType: string, object: string) => {
  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetail(namespace, objectType, object),
    {},
    {},
    auth
  );
};

export const getIstioConfigDetailSubtype = (
  auth: AuthToken,
  namespace: string,
  objectType: string,
  objectSubtype: string,
  object: string
) => {
  return newRequest<IstioConfigDetails>(
    HTTP_VERBS.GET,
    urls.istioConfigDetailSubtype(namespace, objectType, objectSubtype, object),
    {},
    {},
    auth
  );
};

export const deleteIstioConfigDetail = (auth: AuthToken, namespace: string, objectType: string, object: string) => {
  return newRequest<string>(HTTP_VERBS.DELETE, urls.istioConfigDetail(namespace, objectType, object), {}, {}, auth);
};

export const deleteIstioConfigDetailSubtype = (
  auth: AuthToken,
  namespace: string,
  objectType: string,
  objectSubtype: string,
  object: string
) => {
  return newRequest<string>(
    HTTP_VERBS.DELETE,
    urls.istioConfigDetailSubtype(namespace, objectType, objectSubtype, object),
    {},
    {},
    auth
  );
};

export const getServices = (auth: AuthToken, namespace: string) => {
  return newRequest<ServiceList>(HTTP_VERBS.GET, urls.services(namespace), {}, {}, auth);
};

export const getServiceMetrics = (auth: AuthToken, namespace: string, service: string, params: MetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.serviceMetrics(namespace, service), params, {}, auth);
};

export const getApp = (auth: AuthToken, namespace: string, app: string) => {
  return newRequest<App>(HTTP_VERBS.GET, urls.app(namespace, app), {}, {}, auth);
};

export const getApps = (auth: AuthToken, namespace: string) => {
  return newRequest<AppList>(HTTP_VERBS.GET, urls.apps(namespace), {}, {}, auth);
};

export const getAppMetrics = (auth: AuthToken, namespace: string, app: string, params: MetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.appMetrics(namespace, app), params, {}, auth);
};

export const getWorkloadMetrics = (auth: AuthToken, namespace: string, workload: string, params: MetricsOptions) => {
  return newRequest<Metrics>(HTTP_VERBS.GET, urls.workloadMetrics(namespace, workload), params, {}, auth);
};

export const getServiceHealth = (
  auth: AuthToken,
  namespace: string,
  service: string,
  durationSec: number
): Promise<ServiceHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.serviceHealth(namespace, service), params, {}, auth).then(response =>
    ServiceHealth.fromJson(response.data, durationSec)
  );
};

export const getAppHealth = (
  auth: AuthToken,
  namespace: string,
  app: string,
  durationSec: number
): Promise<AppHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.appHealth(namespace, app), params, {}, auth).then(response =>
    AppHealth.fromJson(response.data, durationSec)
  );
};

export const getWorkloadHealth = (
  auth: AuthToken,
  namespace: string,
  workload: string,
  durationSec: number
): Promise<WorkloadHealth> => {
  const params = durationSec ? { rateInterval: String(durationSec) + 's' } : {};
  return newRequest(HTTP_VERBS.GET, urls.workloadHealth(namespace, workload), params, {}, auth).then(response =>
    WorkloadHealth.fromJson(response.data, durationSec)
  );
};

export const getNamespaceAppHealth = (
  auth: AuthToken,
  namespace: string,
  durationSec: number
): Promise<NamespaceAppHealth> => {
  const params: any = {
    type: 'app'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}, auth).then(response => {
    const ret: NamespaceAppHealth = {};
    Object.keys(response.data).forEach(k => {
      ret[k] = AppHealth.fromJson(response.data[k], durationSec);
    });
    return ret;
  });
};

export const getNamespaceServiceHealth = (
  auth: AuthToken,
  namespace: string,
  durationSec: number
): Promise<NamespaceServiceHealth> => {
  const params: any = {
    type: 'service'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}, auth).then(response => {
    const ret: NamespaceServiceHealth = {};
    Object.keys(response.data).forEach(k => {
      ret[k] = ServiceHealth.fromJson(response.data[k], durationSec);
    });
    return ret;
  });
};

export const getNamespaceWorkloadHealth = (
  auth: AuthToken,
  namespace: string,
  durationSec: number
): Promise<NamespaceWorkloadHealth> => {
  const params: any = {
    type: 'workload'
  };
  if (durationSec) {
    params.rateInterval = String(durationSec) + 's';
  }
  return newRequest(HTTP_VERBS.GET, urls.namespaceHealth(namespace), params, {}, auth).then(response => {
    const ret: NamespaceWorkloadHealth = {};
    Object.keys(response.data).forEach(k => {
      ret[k] = WorkloadHealth.fromJson(response.data[k], durationSec);
    });
    return ret;
  });
};

export const getGrafanaInfo = (auth: AuthToken) => {
  return newRequest<GrafanaInfo>(HTTP_VERBS.GET, urls.grafana, {}, {}, auth);
};

export const getJaegerInfo = (auth: AuthToken) => {
  return newRequest<JaegerInfo>(HTTP_VERBS.GET, urls.jaeger, {}, {}, auth);
};

export const getGraphElements = (auth: AuthToken, params: any) => {
  return newRequest(HTTP_VERBS.GET, urls.namespacesGraphElements, params, {}, auth);
};

export const getNodeGraphElements = (auth: AuthToken, node: NodeParamsType, params: any) => {
  switch (node.nodeType) {
    case NodeType.APP:
      return newRequest(
        HTTP_VERBS.GET,
        urls.appGraphElements(node.namespace.name, node.app, node.version),
        params,
        {},
        auth
      );
    case NodeType.SERVICE:
      return newRequest(HTTP_VERBS.GET, urls.serviceGraphElements(node.namespace.name, node.service), params, {}, auth);
    case NodeType.WORKLOAD:
      return newRequest(
        HTTP_VERBS.GET,
        urls.workloadGraphElements(node.namespace.name, node.workload),
        params,
        {},
        auth
      );
    default:
      // default to namespace graph
      return getGraphElements(auth, { namespaces: node.namespace.name, ...params });
  }
};

export const getServerConfig = (auth: AuthToken) => {
  return newRequest<ServerConfig>(HTTP_VERBS.GET, urls.serverConfig, {}, {}, auth);
};

export const getServiceDetail = (auth: AuthToken, namespace: string, service: string): Promise<ServiceDetailsInfo> => {
  return newRequest<ServiceDetailsInfo>(HTTP_VERBS.GET, urls.service(namespace, service), {}, {}, auth).then(r => {
    const info: ServiceDetailsInfo = r.data;
    if (info.health) {
      // Default rate interval in backend = 600s
      info.health = ServiceHealth.fromJson(info.health, 600);
    }
    return info;
  });
};

export const getServiceValidations = (auth: AuthToken, namespace: string, service: string) => {
  return newRequest<Validations>(HTTP_VERBS.GET, urls.serviceValidations(namespace, service), {}, {}, auth);
};

export const getNamespaceValidations = (auth: string, namespace: string) => {
  return newRequest<NamespaceValidations>(HTTP_VERBS.GET, urls.namespaceValidations(namespace), {}, {}, auth);
};

export const getIstioConfigValidations = (auth: AuthToken, namespace: string, objectType: string, object: string) => {
  return newRequest<Validations>(
    HTTP_VERBS.GET,
    urls.istioConfigValidations(namespace, objectType, object),
    {},
    {},
    auth
  );
};

export const getWorkloads = (auth: AuthToken, namespace: string) => {
  return newRequest<WorkloadNamespaceResponse>(HTTP_VERBS.GET, urls.workloads(namespace), {}, {}, auth);
};

export const getWorkload = (auth: AuthToken, namespace: string, name: string) => {
  return newRequest<Workload>(HTTP_VERBS.GET, urls.workload(namespace, name), {}, {}, auth);
};

export const getErrorMsg = (msg: AuthToken, error: AxiosError) => {
  let errorMessage = msg;
  if (error && error.response) {
    if (error.response.data && error.response.data['error']) {
      errorMessage = `${msg}, Error: [ ${error.response.data['error']} ]`;
    } else if (error.response.statusText) {
      errorMessage = `${msg}, Error: [ ${error.response.statusText} ]`;
      if (error.response.status === 401) {
        errorMessage += ' Have your session expired? Try logging again.';
      }
    }
  }
  return errorMessage;
};
