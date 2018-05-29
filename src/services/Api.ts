import axios, { AxiosError } from 'axios';
import { config } from '../config';
import Namespace from '../types/Namespace';
import MetricsOptions from '../types/MetricsOptions';
import { Metrics } from '../types/Metrics';
import ServiceListOptions from '../types/ServiceListOptions';
import { IstioConfigDetails } from '../types/IstioConfigDetails';
import { IstioConfigList } from '../types/IstioConfigListComponent';
import { ServiceDetailsInfo, Validations } from '../types/ServiceInfo';
import JaegerInfo from '../types/JaegerInfo';
import GrafanaInfo from '../types/GrafanaInfo';
import { Health } from '../types/Health';
import { ServiceList } from '../types/ServiceListComponent';

interface Response<T> {
  data: T;
}

const auth = (user: string, pass: string) => {
  return {
    username: user,
    password: pass
  };
};

let newRequest = <T>(method: string, url: string, queryParams: any, data: any) => {
  return new Promise<Response<T>>((resolve, reject) => {
    axios({
      method: method,
      url: url,
      data: data,
      headers: {},
      params: queryParams,
      auth: auth(config().backend.user, config().backend.password)
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
  return newRequest('get', '/api/status', {}, {});
};

export const getNamespaces = (): Promise<Response<Namespace[]>> => {
  return newRequest('get', `/api/namespaces`, {}, {});
};

export const getNamespaceMetrics = (namespace: String, params: any): Promise<Response<Metrics>> => {
  return newRequest('get', `/api/namespaces/${namespace}/metrics`, params, {});
};

export const getIstioConfig = (namespace: String, objects: String[]): Promise<Response<IstioConfigList>> => {
  let params = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  return newRequest('get', `/api/namespaces/${namespace}/istio`, params, {});
};

export const getIstioConfigDetail = (
  namespace: String,
  objectType: String,
  object: String
): Promise<Response<IstioConfigDetails>> => {
  return newRequest('get', `/api/namespaces/${namespace}/istio/${objectType}/${object}`, {}, {});
};

export const getServices = (namespace: String, params?: ServiceListOptions): Promise<Response<ServiceList>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services`, params, {});
};

export const getServiceMetrics = (
  namespace: String,
  service: String,
  params: MetricsOptions
): Promise<Response<Metrics>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/metrics`, params, {});
};

export const getServiceHealth = (namespace: String, service: String): Promise<Response<Health>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/health`, {}, {});
};

export const getGrafanaInfo = (): Promise<Response<GrafanaInfo>> => {
  return newRequest('get', `/api/grafana`, {}, {});
};

export const getJaegerInfo = (): Promise<Response<JaegerInfo>> => {
  return newRequest('get', `/api/jaeger`, {}, {});
};

export const getGraphElements = (namespace: Namespace, params: any) => {
  return newRequest('get', `/api/namespaces/${namespace.name}/graph`, params, {});
};

export const getServiceDetail = (namespace: String, service: String): Promise<Response<ServiceDetailsInfo>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}`, {}, {});
};

export const getServiceValidations = (namespace: String, service: String): Promise<Response<Validations>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/istio_validations`, {}, {});
};

export const getErrorMsg = (msg: string, error: AxiosError) => {
  let errorMessage = msg;
  if (error && error.response && error.response.data && error.response.data['error']) {
    errorMessage = `${msg} Error: [ ${error.response.data['error']} ]`;
  }
  return errorMessage;
};
