import { ServiceHealth, WithServiceHealth } from '../../../types/Health';
import { RequestHealth } from '../../../types/Health';
import { ServiceListItem } from '../../../types/ServiceList';
import * as ServiceListFilters from '../FiltersAndSorts';
import { setServerConfig } from '../../../config/ServerConfig';
import { healthConfig } from '../../../types/__testData__/HealthConfig';

/*
- name of service
- inbound requests
- outbound requests

inbound and outbound requests are objects type { protocol: { code: rate,...}, ...}
example { "http": { "200": 2.3, "404": 1.6}, ...}
 */
const makeService = (
  name,
  inbound: { [key: string]: { [key: string]: number } },
  outbound: { [key: string]: { [key: string]: number } }
): WithServiceHealth<ServiceListItem> => {
  const reqErrs: RequestHealth = { inbound: inbound, outbound: outbound, healthAnnotations: {} };
  const health = new ServiceHealth('bookinfo', 'reviews', reqErrs, {
    rateInterval: 60,
    hasSidecar: true,
    hasAmbient: false
  });

  return {
    name: name,
    health: health
  } as any;
};

describe('SortField#compare', () => {
  describe('sortField = health, is ascending', () => {
    beforeAll(() => {
      setServerConfig(healthConfig);
    });
    const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Health')!;
    it('should return >0 when A service health is better than B (priority)', () => {
      const serviceA = makeService('A', { http: { '200': 1.6 } }, {});
      const serviceB = makeService('B', { http: { '400': 0.4, '200': 1.6 } }, {});
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A service health is worst than B (priority)', () => {
      const serviceA = makeService('A', { http: { '400': 1, '200': 1 } }, {}); // errorRate > Threshold for "error"
      const serviceB = makeService('B', { http: { '400': 0.2, '200': 1.8 } }, {}); // Threshold for "error" > errorRate > Threshold for "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return zero when A and B services has same health (priority)', () => {
      const serviceA = makeService('', { http: { '400': 0.2, '200': 1.8 } }, {});
      const serviceB = makeService('', { http: { '400': 0.2, '200': 1.8 } }, {});
      expect(sortField.compare(serviceA, serviceB)).toBe(0);
    });
    it('should return >0 when A and B have same health and B has more error', () => {
      const serviceA = makeService('ACD', { http: { '400': 0.2, '200': 1.8 } }, {}); // Health resolves to "warn"
      const serviceB = makeService('BDE', { http: { '400': 0.24, '200': 1.76 } }, {}); // Health also resolves to "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A and B have same health rating and A has more error', () => {
      const serviceA = makeService('A', { http: { '400': 0.3, '200': 1.7 } }, {}); // Health resolves to "warn"
      const serviceB = makeService('B', { http: { '400': 0.24, '200': 1.76 } }, {}); // Health also resolves to "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return <0 when A and B have same health (order by name; correct ordering)', () => {
      const serviceA = makeService('A', { http: { '400': 0.22, '200': 1.78 } }, {});
      const serviceB = makeService('B', { http: { '400': 0.22, '200': 1.78 } }, {});
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return >0 when A and B have same health (order by name; incorrect ordering)', () => {
      const serviceA = makeService('A', { http: { '400': 0.22, '200': 1.78 } }, {});
      const serviceB = makeService('B', { http: { '400': 0.22, '200': 1.78 } }, {});
      expect(sortField.compare(serviceB, serviceA)).toBeGreaterThan(0);
    });
  });
});

describe('ServiceListContainer#sortServices', () => {
  beforeAll(() => {
    setServerConfig(healthConfig);
  });
  it('should sort ascending', () => {
    const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Service Name')!;
    const services = [makeService('A', {}, {}), makeService('B', {}, {})];
    const sorted = ServiceListFilters.sortServices(services, sortField, true);
    expect(sorted[0].name).toBe('A');
    expect(sorted[1].name).toBe('B');
  });

  it('should sort descending', () => {
    const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Service Name')!;
    const services = [makeService('A', {}, {}), makeService('B', {}, {})];
    const sorted = ServiceListFilters.sortServices(services, sortField, false);
    expect(sorted[0].name).toBe('B');
    expect(sorted[1].name).toBe('A');
  });
});
