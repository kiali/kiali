import axios, { AxiosError } from 'axios';
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

const loginHeaders = { 'X-Auth-Type-Kiali-UI': '1' };

let newRequest = <T>(method: string, url: string, queryParams: any, data: any, auth: any) => {
  return new Promise<Response<T>>((resolve, reject) => {
    axios({
      method: method,
      url: url,
      data: data,
      headers: { Authorization: auth },
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

export const login = (username: string, password: string) => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: '/api/token',
      headers: loginHeaders,
      auth: { username: username, password: password }
    })
      .then(response => {
        resolve(response);
      })
      .catch(error => {
        reject(error);
      });
  });
};

export const getStatus = (auth: any) => {
  return newRequest('get', '/api/status', {}, {}, auth);
};

export const getNamespaces = (auth: any): Promise<Response<Namespace[]>> => {
  return newRequest('get', `/api/namespaces`, {}, {}, auth);
};

export const getNamespaceMetrics = (auth: any, namespace: String, params: any): Promise<Response<Metrics>> => {
  return newRequest('get', `/api/namespaces/${namespace}/metrics`, params, {}, auth);
};

export const getIstioConfig = (auth: any, namespace: String, objects: String[]): Promise<Response<IstioConfigList>> => {
  let params = objects && objects.length > 0 ? { objects: objects.join(',') } : {};
  return newRequest('get', `/api/namespaces/${namespace}/istio`, params, {}, auth);
};

export const getIstioConfigDetail = (
  auth: any,
  namespace: String,
  objectType: String,
  object: String
): Promise<Response<IstioConfigDetails>> => {
  return newRequest('get', `/api/namespaces/${namespace}/istio/${objectType}/${object}`, {}, {}, auth);
};

export const getServices = (
  auth: any,
  namespace: String,
  params?: ServiceListOptions
): Promise<Response<ServiceList>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services`, params, {}, auth);
};

export const getServiceMetrics = (
  auth: any,
  namespace: String,
  service: String,
  params: MetricsOptions
): Promise<Response<Metrics>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/metrics`, params, {}, auth);
};

export const getServiceHealth = (auth: any, namespace: String, service: String): Promise<Response<Health>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/health`, {}, {}, auth);
};

export const getGrafanaInfo = (auth: any): Promise<Response<GrafanaInfo>> => {
  return newRequest('get', `/api/grafana`, {}, {}, auth);
};

export const getJaegerInfo = (auth: any): Promise<Response<JaegerInfo>> => {
  return newRequest('get', `/api/jaeger`, {}, {}, auth);
};

export const getGraphElements = (auth: any, namespace: Namespace, params: any) => {
  return newRequest('get', `/api/namespaces/${namespace.name}/graph`, params, {}, auth);
};

export const getServiceDetail = (
  auth: any,
  namespace: String,
  service: String
): Promise<Response<ServiceDetailsInfo>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}`, {}, {}, auth);
};

export const getServiceValidations = (
  auth: any,
  namespace: String,
  service: String
): Promise<Response<Validations>> => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/istio_validations`, {}, {}, auth);
};

export const getErrorMsg = (msg: string, error: AxiosError) => {
  let errorMessage = msg;
  if (error && error.response && error.response.data && error.response.data['error']) {
    errorMessage = `${msg} Error: [ ${error.response.data['error']} ]`;
  }
  return errorMessage;
};
