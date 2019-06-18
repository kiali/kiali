import { ServiceHealth, RequestHealth, WithServiceHealth } from '../../../types/Health';
import { ServiceListItem } from '../../../types/ServiceList';
import * as ServiceListFilters from '../FiltersAndSorts';

const makeService = (name: string, errRatio: number): WithServiceHealth<ServiceListItem> => {
  const reqErrs: RequestHealth = { errorRatio: errRatio, inboundErrorRatio: errRatio, outboundErrorRatio: -1 };
  const health = new ServiceHealth(reqErrs, { rateInterval: 60, hasSidecar: true });

  return {
    name: name,
    health: health
  } as any;
};

describe('SortField#compare', () => {
  describe('sortField = health, is ascending', () => {
    const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Health')!;
    it('should return >0 when A service health is better than B (priority)', () => {
      const serviceA = makeService('A', 0);
      const serviceB = makeService('B', 0.2);
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A service health is worst than B (priority)', () => {
      const serviceA = makeService('A', 0.5); // errorRate > Threshold for "error"
      const serviceB = makeService('B', 0.1); // Threshold for "error" > errorRate > Threshold for "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return zero when A and B services has same health (priority)', () => {
      const serviceA = makeService('', 0.1);
      const serviceB = makeService('', 0.1);
      expect(sortField.compare(serviceA, serviceB)).toBe(0);
    });
    it('should return >0 when A and B have same health and B has more error', () => {
      const serviceA = makeService('A', 0.1); // Health resolves to "warn"
      const serviceB = makeService('B', 0.12); // Health also resolves to "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A and B have same health rating and A has more error', () => {
      const serviceA = makeService('A', 0.15); // Health resolves to "warn"
      const serviceB = makeService('B', 0.12); // Health also resolves to "warn"
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return <0 when A and B have same health (order by name; correct ordering)', () => {
      const serviceA = makeService('A', 0.11);
      const serviceB = makeService('B', 0.11);
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return >0 when A and B have same health (order by name; incorrect ordering)', () => {
      const serviceA = makeService('A', 0.11);
      const serviceB = makeService('B', 0.11);
      expect(sortField.compare(serviceB, serviceA)).toBeGreaterThan(0);
    });
  });
});

describe('ServiceListContainer#sortServices', () => {
  const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Service Name')!;
  const services = [makeService('A', -1), makeService('B', -1)];
  it('should sort ascending', done => {
    ServiceListFilters.sortServices(services, sortField, true).then(sorted => {
      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('B');
      done();
    });
  });
  it('should sort descending', done => {
    ServiceListFilters.sortServices(services, sortField, false).then(sorted => {
      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('A');
      done();
    });
  });
});
