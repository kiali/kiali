import { setServerConfig } from '../../../config/ServerConfig';
import { generateTrafficItem, serverRateConfig } from '../__testData__/ErrorRateConfig';
import { getTrafficHealth } from '../TrafficHealth';
import * as H from '../../Health';

describe('getRateHealthConfig', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });
  describe('getTrafficHealth', () => {
    it('should return the ThresholdStatus for a trafficItem', () => {
      var itemA = generateTrafficItem({ '200': [2, 3], '400': [1, 2], '500': [5] });
      const thresholdA = getTrafficHealth(itemA, 'inbound');
      // Default serverRateConfig for 5XX
      expect(thresholdA.value).toBe((5 / 13) * 100);
      expect(thresholdA.status).toBe(H.FAILURE);
    });

    it('Should use annotation instead configuration', () => {
      // Check with annotation to set 400
      const itemB = generateTrafficItem(
        { '200': [2, 3], '400': [1, 2], '500': [5] },
        { 'health.kiali.io/rate': '400,10,20,http,inbound' }
      );
      const thresholdB = getTrafficHealth(itemB, 'inbound');
      expect(thresholdB.value).toBe((3 / 13) * 100);
      expect(thresholdB.status).toBe(H.FAILURE);
    });
  });
});
