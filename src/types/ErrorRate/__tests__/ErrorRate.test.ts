import * as E from '../';
import { setServerConfig } from '../../../config/ServerConfig';
import { serverRateConfig } from '../__testData__/ErrorRateConfig';
import * as H from '../../Health';

describe('getRateHealthConfig', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });
  describe('sumRequests', () => {
    it('should aggregate the requests', () => {
      const inBound = {
        http: {
          '200': 2,
          '401': 1,
          '500': 0.5
        }
      };

      const outBound = {
        http: {
          '200': 5,
          '401': 3,
          '500': 0.6
        },
        grpc: {
          '1': 3,
          '2': 2,
          '3': 0.667
        }
      };

      const result = E.sumRequestsTEST(inBound, outBound);

      expect(result['http']['200']).toBe(7);
      expect(result['grpc']['2']).toBe(2);
      expect(result['grpc']['3']).toBe(0.667);
      expect(result['http']['500']).toBe(1.1);
    });
  });
  describe('calculateStatus', () => {
    it('Should return Failure', () => {
      const requests = {
        requests: {
          http: {
            requestRate: 2,
            errorRate: 1,
            errorRatio: 0.5
          },
          grpc: {
            requestRate: 3,
            errorRate: 2,
            errorRatio: 0.667
          }
        },
        tolerance: {
          code: new RegExp('4dd'),
          degraded: 20,
          failure: 30,
          protocol: new RegExp('http'),
          direction: new RegExp('inbound')
        }
      };
      const tolerance = {
        code: new RegExp('4dd'),
        degraded: 20,
        failure: 30,
        protocol: new RegExp('http'),
        direction: new RegExp('inbound')
      };
      requests.tolerance = tolerance;

      expect(E.calculateStatusTEST([requests])).toStrictEqual({
        protocol: 'http',
        status: {
          value: 50,
          status: H.FAILURE,
          violation: '50.00%>=30%'
        },
        toleranceConfig: tolerance
      });

      // With healthConfigs check priority
      const requestsPriority1 = {
        requests: {
          http: {
            requestRate: 2,
            errorRate: 1,
            errorRatio: 0.5
          }
        },
        tolerance: {
          code: new RegExp('4dd'),
          degraded: 40,
          failure: 100,
          protocol: new RegExp('http'),
          direction: new RegExp('inbound')
        }
      };
      const requestsPriority0 = {
        requests: {
          grpc: {
            requestRate: 3,
            errorRate: 2,
            errorRatio: 0.667
          }
        },
        tolerance: {
          code: new RegExp('3'),
          degraded: 1,
          failure: 3,
          protocol: new RegExp('grpc'),
          direction: new RegExp('inbound')
        }
      };
      expect(E.calculateStatusTEST([requestsPriority1, requestsPriority0])).toStrictEqual({
        protocol: 'grpc',
        status: {
          value: 66.7,
          status: H.FAILURE,
          violation: '66.70%>=3%'
        },
        toleranceConfig: requestsPriority0.tolerance
      });
    });
  });
});
