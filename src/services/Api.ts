import axios from 'axios';
import { config } from '../config';

var auth = (user: string, pass: string) => {
  return {
    username: user,
    password: pass
  };
};

var newRequest = (method: string, url: string, queryParams: any, data: any) => {
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
        reject(new Error(error));
      });
  });
};

export const GetServiceMetrics = (namespace: String, service: String, params: any) => {
  return newRequest('get', `/api/namespaces/${namespace}/services/${service}/metrics`, params, {});
};
