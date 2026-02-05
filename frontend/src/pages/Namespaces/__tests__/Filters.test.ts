import { categoryFilter, healthFilter } from '../Filters';
import { NA } from 'types/Health';

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
    it('includes "No health information" option (NA)', () => {
      expect(healthFilter.filterValues?.some(v => v.id === NA.id)).toBeTruthy();
    });

    it('matches NA when namespace has no status fields', () => {
      const ns: any = { name: 'ns1' };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('matches NA when status is only notAvailable across all types', () => {
      const ns: any = {
        name: 'ns1',
        statusApp: { inError: [], inWarning: [], inNotReady: [], inSuccess: [], notAvailable: ['a'] }
      };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(true);
    });

    it('does not match NA when there are errors', () => {
      const ns: any = {
        name: 'ns1',
        statusApp: { inError: ['a'], inWarning: [], inNotReady: [], inSuccess: [], notAvailable: [] }
      };
      const filters: any = { filters: [{ value: NA.name }] };
      expect(healthFilter.run(ns, filters)).toBe(false);
    });
  });
});
