import ServiceItemComparer from '../ServiceItemComparer';
import { ServiceItem } from '../../../types/ServiceListComponent';

describe('ServiceItemComparer#compareFunction', () => {
  describe('sortField = error_rate, is ascending', () => {
    const comparer = new ServiceItemComparer({ id: 'error_rate', isNumeric: true, title: 'Error Rate' }, true);

    it('should return +1 when A service has more error than B', () => {
      const serviceA = { error_rate: 0.4 } as ServiceItem;
      const serviceB = { error_rate: 0.2 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB)).toBe(1);
    });

    it('should return -1 when A service has more error than B', () => {
      const serviceA = { error_rate: 0.2 } as ServiceItem;
      const serviceB = { error_rate: 0.4 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB)).toBe(-1);
    });

    it('should return zero when A and B services has same error rate', () => {
      const serviceA = { error_rate: 0.1 } as ServiceItem;
      const serviceB = { error_rate: 0.1 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB) === 0).toBeTruthy();
    });
  });

  describe('sortField = error_rate, is descending', () => {
    const comparer = new ServiceItemComparer({ id: 'error_rate', isNumeric: true, title: 'Error Rate' }, false);

    it('should return +1 when A service has more error than B', () => {
      const serviceA = { error_rate: 0.4 } as ServiceItem;
      const serviceB = { error_rate: 0.2 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB)).toBe(-1);
    });

    it('should return -1 when A service has more error than B', () => {
      const serviceA = { error_rate: 0.2 } as ServiceItem;
      const serviceB = { error_rate: 0.4 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB)).toBe(1);
    });

    it('should return zero when A and B services has same error rate', () => {
      const serviceA = { error_rate: 0.1 } as ServiceItem;
      const serviceB = { error_rate: 0.1 } as ServiceItem;

      expect(comparer.compareFunction(serviceA, serviceB) === 0).toBeTruthy();
    });
  });
});
