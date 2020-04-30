import * as API from '../Api';
import { AxiosError } from 'axios';
import { IstioMetricsOptions } from '../../types/MetricsOptions';

describe('#GetErrorString', () => {
  it('should return an error message with status', () => {
    const axErr: AxiosError = {
      config: { method: 'GET' },
      name: 'AxiosError',
      message: 'Error in Response',
      response: {
        data: null,
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    } as AxiosError;
    expect(API.getErrorString(axErr)).toEqual(`InternalError`);
  });
  it('should return an error message with data', () => {
    const responseServerError = 'Internal Error';
    const axErr: AxiosError = {
      config: { method: 'GET' },
      name: 'AxiosError',
      message: 'Error in Response',
      response: {
        data: { error: responseServerError },
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    } as AxiosError;
    expect(API.getErrorString(axErr)).toEqual(`${responseServerError}`);
  });
  it('should return a detail error message with data', () => {
    const responseServerError = 'Internal Error';
    const responseServerDetail = 'Error Detail';
    const axErr: AxiosError = {
      config: { method: 'GET' },
      name: 'AxiosError',
      message: 'Error in Response',
      response: {
        data: { error: responseServerError, detail: responseServerDetail },
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    } as AxiosError;
    expect(API.getErrorDetail(axErr)).toEqual(`${responseServerDetail}`);
  });
  it('should return specific error message for unauthorized', () => {
    const axErr: AxiosError = {
      config: { method: 'GET' },
      name: 'AxiosError',
      message: 'Error in Response',
      response: {
        data: null,
        status: 401,
        statusText: 'Unauthorized',
        headers: null,
        config: {}
      }
    } as AxiosError;
    expect(API.getErrorString(axErr)).toEqual(`Unauthorized: Has your session expired? Try logging in again.`);
  });
});

describe('#Test Methods return a Promise', () => {
  const evaluatePromise = (result: Promise<any>) => {
    expect(result).toBeDefined();
    expect(typeof result).toEqual('object');
    expect(typeof result.then).toEqual('function');
    expect(typeof result.catch).toEqual('function');
  };

  it('#login', () => {
    const result = API.login({ username: 'admin', password: 'admin', token: '' });
    evaluatePromise(result);
  });

  it('#getStatus', () => {
    const result = API.getStatus();
    evaluatePromise(result);
  });

  it('#getNamespaces', () => {
    const result = API.getNamespaces();
    evaluatePromise(result);
  });

  it('#getNamespaceMetrics', () => {
    const result = API.getNamespaceMetrics('istio-system', {} as IstioMetricsOptions);
    evaluatePromise(result);
  });

  it('#getServices', () => {
    const result = API.getServices('istio-system');
    evaluatePromise(result);
  });

  it('#getAppMetrics', () => {
    const result = API.getAppMetrics('istio-system', 'book-info', {} as IstioMetricsOptions);
    evaluatePromise(result);
  });

  it('#getServiceHealth', () => {
    const result = API.getServiceHealth('istio-system', 'book-info', 60, true);
    evaluatePromise(result);
  });

  it('#getGrafanaInfo', () => {
    const result = API.getGrafanaInfo();
    evaluatePromise(result);
  });

  it('#getJaegerInfo', () => {
    const result = API.getJaegerInfo();
    evaluatePromise(result);
  });

  it('#getGraphElements', () => {
    const result = API.getGraphElements({ namespaces: 'istio-system' });
    evaluatePromise(result);
  });

  it('#getServiceDetail', () => {
    const result = API.getServiceDetail('istio-system', '', false);
    evaluatePromise(result);
  });
});
