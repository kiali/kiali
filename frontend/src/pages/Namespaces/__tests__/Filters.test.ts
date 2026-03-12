import { categoryFilter, healthFilter } from '../Filters';
import { DEGRADED, FAILURE, HEALTHY, NA, NOT_READY } from 'types/Health';

describe('Namespaces Filters', () => {
  describe('categoryFilter', () => {
    it('does not match Data plane when namespace has unknown type (isControlPlane undefined)', () => {
      const dataPlaneTitle = categoryFilter.filterValues?.find(v => v.id === 'Data plane')?.title;
      expect(dataPlaneTitle).toBeTruthy();

      const ns: any = { name: 'ns1' }; // isControlPlane is undefined
      const filters: any = { filters: [{ value: dataPlaneTitle }] };
      expect(categoryFilter.run(ns, filters)).toBe(false);
    });
  });

  describe('healthFilter', () => {
    it('includes n/a option (NA)', () => {
      expect(healthFilter.filterValues?.some(v => v.id === NA.id)).toBeTruthy();
    });

    it('matches NA when worstStatus is NA', () => {
      const ns: any = { name: 'ns1', worstStatus: 'NA' };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches NA when worstStatus is undefined', () => {
      const ns: any = { name: 'ns1' };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches Failure when worstStatus is Failure', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Failure' };
      const filters: any = { filters: [{ value: FAILURE.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches Degraded when worstStatus is Degraded', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Degraded' };
      const filters: any = { filters: [{ value: DEGRADED.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches Healthy when worstStatus is Healthy', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Healthy' };
      const filters: any = { filters: [{ value: HEALTHY.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches Not Ready when worstStatus is Not Ready', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Not Ready' };
      const filters: any = { filters: [{ value: NOT_READY.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('does not match NA when worstStatus is Failure', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Failure' };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(false);
    });

    it('matches when multiple filters are selected', () => {
      const ns: any = { name: 'ns1', worstStatus: 'Degraded' };
      const filters: any = { filters: [{ value: FAILURE.name }, { value: DEGRADED.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });
  });
});
