import { sortFields, sortServices } from '../ServiceListComponent';
import { ServiceItem } from '../../../types/ServiceListComponent';
import { ServiceHealth, RequestHealth, EnvoyHealth } from '../../../types/Health';

const makeService = (name: string, reqCount: number, errCount: number): ServiceItem & { health: ServiceHealth } => {
  const reqErrs: RequestHealth = {
    requestCount: reqCount,
    requestErrorCount: errCount
  };
  const envoy: EnvoyHealth = {
    inbound: { healthy: 0, total: 0 },
    outbound: { healthy: 0, total: 0 }
  };
  return { name: name, health: new ServiceHealth(envoy, reqErrs, 60) } as ServiceItem & {
    health: ServiceHealth;
  };
};

describe('SortField#compare', () => {
  describe('sortField = error_rate, is ascending', () => {
    const sortField = sortFields.find(s => s.title === 'Error Rate')!;
    it('should return >0 when A service has more error than B', () => {
      const serviceA = makeService('A', 10, 4);
      const serviceB = makeService('B', 10, 2);
      expect(sortField.compare(serviceA, serviceB)).toBeGreaterThan(0);
    });
    it('should return <0 when A service has more error than B', () => {
      const serviceA = makeService('A', 10, 2);
      const serviceB = makeService('B', 10, 4);
      expect(sortField.compare(serviceA, serviceB)).toBeLessThan(0);
    });
    it('should return zero when A and B services has same error rate', () => {
      const serviceA = makeService('', 10, 1);
      const serviceB = makeService('', 10, 1);
      expect(sortField.compare(serviceA, serviceB)).toBe(0);
    });
  });
});

describe('ServiceListComponent#sortServices', () => {
  const sortField = sortFields.find(s => s.title === 'Service Name')!;
  const services = [makeService('A', 0, 0), makeService('B', 0, 0)];
  it('should sort ascending', done => {
    sortServices(services, sortField, true).then(sorted => {
      expect(sorted[0].name).toBe('A');
      expect(sorted[1].name).toBe('B');
      done();
    });
  });
  it('should sort descending', done => {
    sortServices(services, sortField, false).then(sorted => {
      expect(sorted[0].name).toBe('B');
      expect(sorted[1].name).toBe('A');
      done();
    });
  });
});
