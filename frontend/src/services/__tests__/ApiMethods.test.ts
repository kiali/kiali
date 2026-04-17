import axios from 'axios';
import axiosMockAdapter from 'axios-mock-adapter';

import * as API from '../Api';
import * as Auth from '../../types/Auth';
import { IstioMetricsOptions } from '../../types/MetricsOptions';
import { ServiceListQuery } from '../../types/ServiceList';

describe('#getHeaders via public API calls', () => {
  let mock: axiosMockAdapter;

  beforeEach(() => {
    mock = new axiosMockAdapter(axios);
    mock.onAny().reply(200, {});
  });

  afterEach(() => {
    mock.restore();
    jest.restoreAllMocks();
  });

  it('should include Kiali-UI and Content-Type on GET requests', async () => {
    await API.getStatus();

    expect(mock.history.get).toHaveLength(1);
    const headers = mock.history.get[0].headers!;
    expect(headers['Kiali-UI']).toBe('true');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Auth-Type-Kiali-UI']).toBe('1');
  });

  it('should not include X-CSRFToken on GET requests', async () => {
    jest.spyOn(Auth, 'getCSRFToken').mockReturnValue('test-csrf-token');

    await API.getStatus();

    const headers = mock.history.get[0].headers!;
    expect(headers['X-CSRFToken']).toBeUndefined();
  });

  it('should include X-CSRFToken on non-GET requests when token exists', async () => {
    jest.spyOn(Auth, 'getCSRFToken').mockReturnValue('test-csrf-token');

    await API.createIstioConfigDetail(
      'test-ns',
      { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' },
      '{}'
    );

    expect(mock.history.post).toHaveLength(1);
    const headers = mock.history.post[0].headers!;
    expect(headers['X-CSRFToken']).toBe('test-csrf-token');
  });

  it('should not include X-CSRFToken on non-GET requests when token is undefined', async () => {
    jest.spyOn(Auth, 'getCSRFToken').mockReturnValue(undefined);

    await API.createIstioConfigDetail(
      'test-ns',
      { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' },
      '{}'
    );

    const headers = mock.history.post[0].headers!;
    expect(headers['X-CSRFToken']).toBeUndefined();
  });

  it('should use url-encoded Content-Type for login', async () => {
    mock.onPost().reply(200, {});

    await API.login({ username: 'admin', password: 'admin', token: '' });

    expect(mock.history.post).toHaveLength(1);
    const headers = mock.history.post[0].headers!;
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(headers['Kiali-UI']).toBe('true');
  });
});

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

  it('#getNamespace', () => {
    const result = API.getNamespaceInfo('istio-system');
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
