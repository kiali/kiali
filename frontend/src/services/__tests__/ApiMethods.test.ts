import * as API from '../Api';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { ServiceListQuery } from '../../types/ServiceList';

describe('#GetErrorString', () => {
  it('should return an error message with status', () => {
    const axErr: any = {
      config: { method: 'GET' },
      name: 'ApiError',
      message: 'Error in Response',
      response: {
        data: null,
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    };

    expect(API.getErrorString(axErr)).toEqual(`InternalError`);
  });

  it('should return an error message with data', () => {
    const responseServerError = 'Internal Error';
    const axErr: any = {
      config: { method: 'GET' },
      name: 'ApiError',
      message: 'Error in Response',
      response: {
        data: { error: responseServerError },
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    };

    expect(API.getErrorString(axErr)).toEqual(`${responseServerError}`);
  });

  it('should return a detail error message with data', () => {
    const responseServerError = 'Internal Error';
    const responseServerDetail = 'Error Detail';
    const axErr: any = {
      config: { method: 'GET' },
      name: 'ApiError',
      message: 'Error in Response',
      response: {
        data: { error: responseServerError, detail: responseServerDetail },
        status: 400,
        statusText: 'InternalError',
        headers: null,
        config: {}
      }
    };

    expect(API.getErrorDetail(axErr)).toEqual(`${responseServerDetail}`);
  });

  it('should return specific error message for unauthorized', () => {
    const axErr: any = {
      config: { method: 'GET' },
      name: 'ApiError',
      message: 'Error in Response',
      response: {
        data: null,
        status: 401,
        statusText: 'Unauthorized',
        headers: null,
        config: {}
      }
    };

    expect(API.getErrorString(axErr)).toEqual(`Unauthorized: Has your session expired? Try logging in again.`);
  });
});

// TODO SKIP THESE TO GET NODE 16 TO WORK
// WE NEED TO MOCK THE AXIOS SERVICE AND CHECK THAT AXIOS IS BEING CALLED
// (UNIT TESTS SHOULD NOT CALL DIRECTLY TO API BUT MOCK THEM).
describe.skip('#Test Methods return a Promise', () => {
  const evaluatePromise = (result: Promise<any>): void => {
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

  it('#getClustersServices', () => {
    const result = API.getClustersServices('istio-system', {} as ServiceListQuery);
    evaluatePromise(result);
  });

  it('#getAppMetrics', () => {
    const result = API.getAppMetrics('istio-system', 'book-info', {} as IstioMetricsOptions);
    evaluatePromise(result);
  });

  it('#getGrafanaInfo', () => {
    const result = API.getGrafanaInfo();
    evaluatePromise(result);
  });

  it('#getTracingInfo', () => {
    const result = API.getTracingInfo();
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
