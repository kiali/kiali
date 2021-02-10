import { setServerConfig } from '../../../config/ServerConfig';
import { serverRateConfig } from '../__testData__/ErrorRateConfig';
import { calculateStatusGraph, generateRateForGraphTolerance, getTotalRequest } from '../GraphEdgeStatus';
import { Responses } from '../../Graph';
import { RequestTolerance } from '../types';
import { ToleranceConfig } from '../../ServerConfig';
import * as H from '../../Health';

const tolerance400: ToleranceConfig = {
  code: new RegExp(/400/),
  degraded: 10,
  failure: 20,
  protocol: new RegExp(/http/),
  direction: new RegExp(/inbound/)
};

const tolerance500: ToleranceConfig = {
  code: new RegExp(/500/),
  degraded: 10,
  failure: 20,
  protocol: new RegExp(/http/),
  direction: new RegExp(/inbound/)
};

describe('getRateHealthConfig', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });

  it('getTotalRequest', () => {
    // Check with annotation to set 400
    const resp: Responses = {
      '200': { hosts: {}, flags: { '-': '3', XX: '4', YYY: '2' } },
      '400': { hosts: {}, flags: { '-': '1', XX: '1', YYY: '6' } }
    };
    expect(getTotalRequest(resp)).toBe(17);
  });
  describe('calculateStatusGraph', () => {
    it('case A is FAILURE for 400', () => {
      const tolerances: RequestTolerance[] = [
        {
          tolerance: tolerance400,
          requests: { http: 8 }
        }
      ];

      // Check with annotation to set 400
      const resp: Responses = {
        '200': { hosts: {}, flags: { '-': '3', XX: '4', YYY: '2' } },
        '400': { hosts: {}, flags: { '-': '1', XX: '1', YYY: '6' } }
      };

      const status = calculateStatusGraph(tolerances, resp);
      expect(status.toleranceConfig).toBe(tolerances[0].tolerance);
      expect(status.protocol).toBe('http');
      expect(status.status.value).toBe((8 / 17) * 100);
      expect(status.status.status).toBe(H.FAILURE);
    });

    it('case A is HEALTHY for 500', () => {
      const tolerances: RequestTolerance[] = [
        {
          tolerance: tolerance500,
          requests: { http: 0 }
        }
      ];

      // Check with annotation to set 400
      const resp: Responses = {
        '200': { hosts: {}, flags: { '-': '3', XX: '4', YYY: '2' } },
        '400': { hosts: {}, flags: { '-': '1', XX: '1', YYY: '6' } }
      };

      const status = calculateStatusGraph(tolerances, resp);
      expect(status.toleranceConfig).toBe(tolerances[0].tolerance);
      expect(status.protocol).toBe('http');
      expect(status.status.value).toBe((0 / 17) * 100);
      expect(status.status.status).toBe(H.HEALTHY);
    });

    it('case A is the worst case FAILURE here for multiple tolerances', () => {
      const tolerances: RequestTolerance[] = [
        {
          tolerance: tolerance500,
          requests: { http: 0 }
        },
        {
          tolerance: tolerance400,
          requests: { http: 8 }
        }
      ];

      // Check with annotation to set 400
      const resp: Responses = {
        '200': { hosts: {}, flags: { '-': '3', XX: '4', YYY: '2' } },
        '400': { hosts: {}, flags: { '-': '1', XX: '1', YYY: '6' } }
      };

      const status = calculateStatusGraph(tolerances, resp);
      expect(status.toleranceConfig).toBe(tolerances[1].tolerance);
      expect(status.protocol).toBe('http');
      expect(status.status.value).toBe((8 / 17) * 100);
      expect(status.status.status).toBe(H.FAILURE);
    });
  });

  it('generateRateForGraphTolerance', () => {
    var toleranceFor400: RequestTolerance = {
      tolerance: tolerance400,
      requests: {}
    };

    var toleranceFor400_500: RequestTolerance = {
      tolerance: {
        code: new RegExp(/[45]\d\d/),
        degraded: 10,
        failure: 20,
        protocol: new RegExp(/http/),
        direction: new RegExp(/inbound/)
      },
      requests: {}
    };

    const requests: H.RequestType = {
      http: {
        '200': 2,
        '400': 4,
        '500': 5
      },
      grpc: {
        '14': 2
      }
    };

    generateRateForGraphTolerance(toleranceFor400, requests);
    generateRateForGraphTolerance(toleranceFor400_500, requests);

    expect(toleranceFor400.requests['http']).toBe(4);
    expect(toleranceFor400_500.requests['http']).toBe(9);
  });
});
