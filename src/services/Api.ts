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
import GrafanaInfo from '../types/GrafanaInfo';
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
import { GraphParamsType, NodeParamsType, NodeType } from '../types/Graph';
import { config } from '../config';
import { AuthToken, HTTP_VERBS } from '../types/Common';

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

const newRequest = <T>(method: HTTP_VERBS, url: string, queryParams: any, data: any, auth?: AuthToken) => {
  return new Promise<Response<Readonly<T>>>((resolve, reject) => {
    axios({
      method: method,
      url: url,
      data: data,
      headers: getHeaders(auth),
      params: queryParams
    })
      .then(response => {
        resolve(response);
      })
      .catch(error => {
        reject(error);
      });
  });
};

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

export const getNamespaces = (auth: AuthToken): Promise<Response<Namespace[]>> => {
  return newRequest(HTTP_VERBS.GET, urls.namespaces, {}, {}, auth);
};

export const getNamespaceMetrics = (
  auth: AuthToken,
  namespace: string,
  params: any
): Promise<Response<Readonly<Metrics>>> => {
  return newRequest(HTTP_VERBS.GET, urls.namespaceMetrics(namespace), params, {}, auth);
};

export const getIstioConfig = (
  auth: AuthToken,
  namespace: string,
  objects: string[]
): Promise<Response<IstioConfigList>> => {
  const params = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  return newRequest(HTTP_VERBS.GET, urls.istioConfig(namespace), params, {}, auth);
};

export const getIstioConfigDetail = (
  auth: AuthToken,
  namespace: string,
  objectType: string,
  object: string
): Promise<Response<IstioConfigDetails>> => {
  return newRequest(HTTP_VERBS.GET, urls.istioConfigDetail(namespace, objectType, object), {}, {}, auth);
};

export const getServices = (auth: AuthToken, namespace: string): Promise<Response<ServiceList>> => {
  return newRequest(HTTP_VERBS.GET, urls.services(namespace), {}, {}, auth);
};

export const getServiceMetrics = (
  auth: AuthToken,
  namespace: string,
  service: string,
  params: MetricsOptions
): Promise<Response<Metrics>> => {
  return newRequest(HTTP_VERBS.GET, urls.serviceMetrics(namespace, service), params, {}, auth);
};

export const getApp = (auth: AuthToken, namespace: string, app: string): Promise<Response<App>> => {
  return newRequest(HTTP_VERBS.GET, urls.app(namespace, app), {}, {}, auth);
};

export const getApps = (auth: AuthToken, namespace: string): Promise<Response<AppList>> => {
  return newRequest(HTTP_VERBS.GET, urls.apps(namespace), {}, {}, auth);
};

export const getAppMetrics = (
  auth: AuthToken,
  namespace: string,
  app: string,
  params: MetricsOptions
): Promise<Response<Metrics>> => {
  return newRequest(HTTP_VERBS.GET, urls.appMetrics(namespace, app), params, {}, auth);
};

export const getWorkloadMetrics = (
  auth: AuthToken,
  namespace: string,
  workload: string,
  params: MetricsOptions
): Promise<Response<Metrics>> => {
  return newRequest(HTTP_VERBS.GET, urls.workloadMetrics(namespace, workload), params, {}, auth);
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

export const getGrafanaInfo = (auth: AuthToken): Promise<Response<GrafanaInfo>> => {
  return newRequest(HTTP_VERBS.GET, urls.grafana, {}, {}, auth);
};

export const getJaegerInfo = (auth: AuthToken): Promise<Response<JaegerInfo>> => {
  return newRequest(HTTP_VERBS.GET, urls.jaeger, {}, {}, auth);
};

export const getGraphElements = (auth: AuthToken, namespace: Namespace, params: any) => {
  return newRequest(HTTP_VERBS.GET, urls.namespaceGraphElements(namespace.name), params, {}, auth);
};

export const getNodeGraphElements = (
  auth: AuthToken,
  namespace: Namespace,
  node: NodeParamsType,
  params: Partial<GraphParamsType>
) => {
  switch (node.nodeType) {
    case NodeType.APP:
      return newRequest(
        HTTP_VERBS.GET,
        urls.appGraphElements(namespace.name, node.app, node.version),
        params,
        {},
        auth
      );
    case NodeType.SERVICE:
      return newRequest(HTTP_VERBS.GET, urls.serviceGraphElements(namespace.name, node.service), params, {}, auth);
    case NodeType.WORKLOAD:
      return newRequest(HTTP_VERBS.GET, urls.workloadGraphElements(namespace.name, node.workload), params, {}, auth);
    default:
      // default to namespace graph
      return getGraphElements(auth, namespace, params);
  }
};

export const getServiceDetail = (auth: AuthToken, namespace: string, service: string): Promise<ServiceDetailsInfo> => {
  return newRequest(HTTP_VERBS.GET, urls.service(namespace, service), {}, {}, auth).then(
    (r: Response<ServiceDetailsInfo>) => {
      const info: ServiceDetailsInfo = r.data;
      info.istioSidecar = info.istioSidecar;
      if (info.health) {
        // Default rate interval in backend = 600s
        info.health = ServiceHealth.fromJson(info.health, 600);
      }
      return info;
    }
  );
};

export const getServiceValidations = (
  auth: AuthToken,
  namespace: string,
  service: string
): Promise<Response<Validations>> => {
  return newRequest(HTTP_VERBS.GET, urls.serviceValidations(namespace, service), {}, {}, auth);
};

export const getNamespaceValidations = (auth: string, namespace: string): Promise<Response<NamespaceValidations>> => {
  return newRequest(HTTP_VERBS.GET, urls.namespaceValidations(namespace), {}, {}, auth);
};

export const getIstioConfigValidations = (
  auth: AuthToken,
  namespace: string,
  objectType: string,
  object: string
): Promise<Response<Validations>> => {
  return newRequest(HTTP_VERBS.GET, urls.istioConfigValidations(namespace, objectType, object), {}, {}, auth);
};

export const getWorkloads = (auth: AuthToken, namespace: string): Promise<Response<WorkloadNamespaceResponse>> => {
  return newRequest(HTTP_VERBS.GET, urls.workloads(namespace), {}, {}, auth);
};

export const getWorkload = (auth: AuthToken, namespace: string, name: string): Promise<Response<Workload>> => {
  return newRequest(HTTP_VERBS.GET, urls.workload(namespace, name), {}, {}, auth);
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
