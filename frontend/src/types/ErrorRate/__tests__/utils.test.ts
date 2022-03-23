import {
  aggregate,
  checkExpr,
  getErrorCodeRate,
  getRateHealthConfig,
  getHealthRateAnnotation,
  requestsErrorRateCode,
  transformEdgeResponses
} from '../utils';
import { serverConfig, setServerConfig } from '../../../config/ServerConfig';
import { annotationSample, generateRequestHealth, serverRateConfig } from '../__testData__/ErrorRateConfig';
import { Rate } from '../types';
import { Responses } from '../../Graph';
import { RequestType } from '../../Health';
import { HealthAnnotationType } from '../../HealthAnnotation';

describe('getRateHealthConfig', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });
  it('requestsErrorRateCode', () => {
    const req: RequestType = { http: { '200': 40.1, '400': 30.2 } };
    expect(requestsErrorRateCode(req)).toBe((30.2 / 70.3) * 100);

    // Case no rate
    expect(requestsErrorRateCode({})).toBe(-1);
  });

  it('getHealthRateAnnotation', () => {
    const annotation: HealthAnnotationType = { 'health.kiali.io/rate': '400,10,30,htpp,inbound' };
    const wrongAnnotation: HealthAnnotationType = { rate: '400,10,30,htpp,inbound' };

    expect(getHealthRateAnnotation(undefined)).toBeUndefined();
    expect(getHealthRateAnnotation(wrongAnnotation)).toBeUndefined();
    expect(getHealthRateAnnotation(annotation)).toBe('400,10,30,htpp,inbound');
  });

  it('getErrorCodeRate', () => {
    const inbound = { htpp: { '200': 2.3, '400': 1.2 } };
    const outbound = { htpp: { '200': 1.2, '500': 2 } };
    const requests = generateRequestHealth(annotationSample, inbound, outbound);
    const errorCodeRate = getErrorCodeRate(requests);

    expect(errorCodeRate.inbound).toBe(requestsErrorRateCode(inbound));
    expect(errorCodeRate.outbound).toBe(requestsErrorRateCode(outbound));
  });

  it('getRateHealthConfig should return rate object or undefined', () => {
    expect(checkExpr(undefined, 'app')).toBeTruthy();
    expect(checkExpr(new RegExp(/book/), 'bookinfo')).toBeTruthy();
    expect(checkExpr(new RegExp(/b(.*)/), 'bookinfo')).toBeTruthy();
    expect(checkExpr('book', 'bookinfo')).toBeTruthy();
    expect(checkExpr('b.*', 'bookinfo')).toBeTruthy();

    expect(checkExpr(new RegExp(/book/), 'app')).toBeFalsy();
    expect(checkExpr(new RegExp(/b(.*)/), 'app')).toBeFalsy();
    expect(checkExpr('book', 'app')).toBeFalsy();
    expect(checkExpr('b.*', 'app')).toBeFalsy();
  });

  it('getRateHealthConfig should return rate object or undefined', () => {
    expect(getRateHealthConfig('bookinfo', 'reviews', 'app')).toBeDefined();
    expect(typeof getRateHealthConfig('bookinfo', 'reviews', 'app')).toBe('object');
    expect(getRateHealthConfig('bookinfo', 'reviews', 'app')).toBe(serverConfig.healthConfig!.rate[0]);

    expect(getRateHealthConfig('bookinfo', 'error-rev-iews', 'app')).toBe(serverConfig.healthConfig!.rate[1]);
    expect(getRateHealthConfig('bookinfo', 'reviews', 'workloadss')).toBe(serverConfig.healthConfig!.rate[1]);
    expect(getRateHealthConfig('istio-system', 'reviews', 'workload')).toBe(serverConfig.healthConfig!.rate[1]);
  });

  it('transformEdgeResponses should return a RequestType from edge response and protocol', () => {
    const edgeResponse: Responses = {
      '200': { flags: { '-': '1.2', XXX: '3.1' }, hosts: { 'w-server.alpha.svc.cluster.local': '46.1' } }
    };
    const protocol = 'http';
    const requestType = transformEdgeResponses(edgeResponse, protocol);

    expect(requestType).toBeDefined();
    expect(requestType[protocol]).toBeDefined();
    Object.keys(edgeResponse).forEach(code => {
      expect(requestType[protocol][code]).toBeDefined();
      const percentRate = Object.values(edgeResponse[code].flags).reduce((acc, value) =>
        String(Number(acc) + Number(value))
      );
      expect(requestType[protocol][code]).toBe(Number(percentRate));
    });
  });

  it('aggregate should aggregate the requests', () => {
    const requests = {
      http: {
        '501': 3,
        '404': 2,
        '200': 4,
        '100': 1
      },
      grpc: {
        '1': 3,
        '16': 2
      }
    };

    let result = aggregate(requests, serverRateConfig.healthConfig.rate[1].tolerance);
    let requestsResult = result[0].requests;
    expect((requestsResult['http'] as Rate).requestRate).toBe(10);
    expect((requestsResult['http'] as Rate).errorRate).toBe(3);
    requestsResult = result[1].requests;
    expect((requestsResult['grpc'] as Rate).requestRate).toBe(5);
    expect((requestsResult['grpc'] as Rate).errorRate).toBe(5);

    result = aggregate(requests, [
      {
        code: new RegExp('200'),
        protocol: new RegExp('http'),
        direction: new RegExp('inbound'),
        failure: 2,
        degraded: 1
      },
      {
        code: new RegExp('16'),
        protocol: new RegExp('grpc'),
        direction: new RegExp('inbound'),
        failure: 2,
        degraded: 1
      }
    ]);

    const requestsTolerance1 = result[0].requests;

    expect((requestsTolerance1['http'] as Rate).requestRate).toBe(10);
    expect((requestsTolerance1['http'] as Rate).errorRate).toBe(4);

    expect(requestsTolerance1['grpc']).toBeUndefined();

    const requestsTolerance2 = result[1].requests;

    expect(requestsTolerance2['http']).toBeUndefined();

    expect((requestsTolerance2['grpc'] as Rate).requestRate).toBe(5);
    expect((requestsTolerance2['grpc'] as Rate).errorRate).toBe(2);
  });
});
