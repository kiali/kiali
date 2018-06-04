import * as GraphData from '../__mockData__/getGraphElements';
import { AxiosError } from 'axios';
import ServiceListOptions from '../../types/ServiceListOptions';

const fs = require('fs');

export const mockPromiseFromFile = (path: string) => {
  return new Promise((resolve, reject) => {
    fs.readFile(path, 'utf8', (err, data) => {
      if (err) {
        reject(err);
      } else {
        // Parse the data as JSON and put in the key entity (just like the request library does)
        resolve({ data: JSON.parse(data) });
      }
    });
  });
};

export const getNamespaces = () => {
  return mockPromiseFromFile(`./src/services/__mockData__/getNamespaces.json`);
};

export const getServices = (namespace: String, params?: ServiceListOptions) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getServices.json`);
};

export const getGrafanaInfo = () => {
  return mockPromiseFromFile(`./src/services/__mockData__/getGrafanaInfo.json`);
};

export const getJaegerInfo = () => {
  return mockPromiseFromFile(`./src/services/__mockData__/getJaegerInfo.json`);
};

export const getGraphElements = (namespace: string, params: any) => {
  if (GraphData.hasOwnProperty(namespace)) {
    return Promise.resolve({ data: GraphData[namespace] });
  } else {
    return Promise.resolve({ data: {} });
  }
};

export const getServiceDetail = (namespace: String, service: String) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getServiceDetail.json`);
};

export const getServiceValidations = (namespace: String, service: String) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getServiceValidations.json`);
};

export const getNamespaceValidations = (namespace: String, service: String) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getNamespaceValidations.json`);
};

export const getIstioConfig = (namespace: String) => {
  if (namespace === 'bookinfo') {
    return mockPromiseFromFile(`./src/services/__mockData__/getIstioConfigBookinfo.json`);
  }
  let emptyIstioConfig = {
    namespace: {
      name: namespace
    },
    routeRules: [],
    destinationPolicies: [],
    virtualServices: [],
    destinationRules: [],
    rules: []
  };
  return new Promise(resolve => {
    resolve({ data: emptyIstioConfig });
  });
};

export const getIstioConfigDetail = (namespace: String, objectType: String, object: String) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getIstioConfigDetail.json`);
};

export const getIstioConfigValidations = (namespace: String, objectType: String, object: String) => {
  return mockPromiseFromFile(`./src/services/__mockData__/getIstioConfigValidations.json`);
};

export const getServiceHealth = () => {
  return mockPromiseFromFile(`./src/services/__mockData__/getServiceHealth.json`);
};

export const getNamespaceMetrics = (namespace: String, params: any) => {
  return Promise.resolve({
    data: {
      metrics: {
        request_count_in: { matrix: [] },
        request_error_count_in: { matrix: [] }
      }
    }
  });
};

export const getErrorMsg = (msg: string, error: AxiosError) => {
  let errorMessage = msg;
  if (error && error.response && error.response.data && error.response.data['error']) {
    errorMessage = `${msg} Error: [ ${error.response.data['error']} ]`;
  }
  return errorMessage;
};
