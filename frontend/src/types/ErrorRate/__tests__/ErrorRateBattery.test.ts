import { calculateErrorRate } from '../ErrorRate';
import { getRateHealthConfig } from '../utils';
// Imported directly from source modules to avoid TDZ issues with the barrel's
// re-export aliases (e.g. calculateStatusTEST) under Rspack ESM bundling.
import { setServerConfig } from '../../../config/ServerConfig';
import { annotationSample, generateRequestHealth, serverRateConfig } from '../__testData__/ErrorRateConfig';
import { RateHealth } from '../../HealthAnnotation';

describe('getRateHealthConfig', () => {
  beforeAll(() => {
    setServerConfig(serverRateConfig);
  });
  describe('Be sure that the configuration is used correctly', () => {
    it('Case Node A has annotation and default configuration ', () => {
      // Check that there is a default configuration for this node
      expect(getRateHealthConfig('alpha', 'x-server', 'service')).toBeDefined();
      const result = calculateErrorRate('alpha', 'x-server', 'service', generateRequestHealth(annotationSample));
      const rate = new RateHealth(annotationSample);
      expect(result.config).toEqual(rate.toleranceConfig);
    });

    it('Case Node A has not annotation', () => {
      // Check that there is a default configuration for this node
      const config = getRateHealthConfig('alpha', 'x-server', 'service');
      expect(config).toBeDefined();
      const result = calculateErrorRate('alpha', 'x-server', 'service', generateRequestHealth({}));
      expect(result.config).toEqual(config.tolerance);
    });
  });
});
