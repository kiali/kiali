import axios from 'axios';
import { config } from '../config';

const auth = (user: string, pass: string) => {
  return {
    username: user,
    password: pass
  };
};

const newRequest = (method: string, url: string, queryParams: any, data: any) => {
  console.log(url);
  return new Promise((resolve, reject) => {
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

export const GetNamespaces = () => {
  return newRequest('get', `/api/namespaces`, {}, {});
};

export const GetServices = (namespace: String) => {
  return newRequest('get', `/api/namespaces/${namespace}/services`, {}, {});
};

export const getServiceMetrics = (namespace: String, service: String, params: any) => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/metrics`, params, {});
};

export const getGrafanaInfo = () => {
  return newRequest('get', `/api/grafana`, {}, {});
};
