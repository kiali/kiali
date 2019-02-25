import * as API from '../Api';
import { AxiosError } from 'axios';
import { authentication } from '../../utils/Authentication';
import { MetricsOptions } from '../../types/MetricsOptions';

describe('#GetErrorMessage', () => {
  const errormsg = 'Error sample';
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
    };
    expect(API.getErrorMsg(errormsg, axErr)).toEqual(`${errormsg}, Error: [ InternalError ]`);
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
    };
    expect(API.getErrorMsg(errormsg, axErr)).toEqual(`${errormsg}, Error: [ ${responseServerError} ]`);
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
    };
    expect(API.getErrorMsg(errormsg, axErr)).toEqual(
      `${errormsg}, Error: [ Unauthorized ] Have your session expired? Try logging again.`
    );
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
    const result = API.login({ username: 'admin', password: 'admin' });
    evaluatePromise(result);
  });

  it('#getStatus', () => {
    const result = API.getStatus();
    evaluatePromise(result);
  });

  it('#getNamespaces', () => {
    const result = API.getNamespaces(authentication());
    evaluatePromise(result);
  });

  it('#getNamespaceMetrics', () => {
    const result = API.getNamespaceMetrics(authentication(), 'istio-system', {} as MetricsOptions);
    evaluatePromise(result);
  });

  it('#getServices', () => {
    const result = API.getServices(authentication(), 'istio-system');
    evaluatePromise(result);
  });

  it('#getAppMetrics', () => {
    const result = API.getAppMetrics(authentication(), 'istio-system', 'book-info', {} as MetricsOptions);
    evaluatePromise(result);
  });

  it('#getServiceHealth', () => {
    const result = API.getServiceHealth(authentication(), 'istio-system', 'book-info', 60, true);
    evaluatePromise(result);
  });

  it('#getGrafanaInfo', () => {
    const result = API.getGrafanaInfo(authentication());
    evaluatePromise(result);
  });

  it('#getJaegerInfo', () => {
    const result = API.getJaegerInfo(authentication());
    evaluatePromise(result);
  });

  it('#getGraphElements', () => {
    const result = API.getGraphElements(authentication(), { namespaces: 'istio-system' });
    evaluatePromise(result);
  });

  it('#getServiceDetail', () => {
    const result = API.getServiceDetail(authentication(), 'istio-system', '', false);
    evaluatePromise(result);
  });
});
