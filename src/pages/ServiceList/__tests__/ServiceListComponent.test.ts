import { ServiceListItem } from '../../../types/ServiceList';
import { ServiceHealth, RequestHealth, EnvoyHealth } from '../../../types/Health';
import { ServiceListFilters } from '../FiltersAndSorts';

const makeService = (name: string, errRatio: number): ServiceListItem & { health: ServiceHealth } => {
  const reqErrs: RequestHealth = { errorRatio: errRatio, inboundErrorRatio: errRatio, outboundErrorRatio: -1 };
  const envoy: EnvoyHealth = {
    inbound: { healthy: 0, total: 0 },
    outbound: { healthy: 0, total: 0 }
  };
  return { name: name, health: new ServiceHealth(envoy, reqErrs, 60) } as ServiceListItem & {
    health: ServiceHealth;
  };
};

describe('SortField#compare', () => {
  describe('sortField = error_rate, is ascending', () => {
    const sortField = ServiceListFilters.sortFields.find(s => s.title === 'Error Rate')!;
    it('should return >0 when A service has more error than B', () => {
      const serviceA = makeService('A', 0.4);
      const serviceB = makeService('B', 0.2);
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A service has more error than B', () => {
      const serviceA = makeService('A', 0.2);
      const serviceB = makeService('B', 0.4);
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return zero when A and B services has same error rate', () => {
      const serviceA = makeService('', 0.1);
      const serviceB = makeService('', 0.1);
      expect(sortField.compare(serviceA, serviceB)).toBe(0);
    });
  });
});

describe('ServiceListComponent#sortServices', () => {
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
