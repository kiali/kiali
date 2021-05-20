import { filterByName, IstioConfigItem, IstioConfigList, toIstioItems } from '../../../types/IstioConfigList';
import * as IstioConfigListFilters from '../FiltersAndSorts';
import { SortField } from '../../../types/SortFilters';

const mockIstioConfigList = (names: string[]): IstioConfigList => {
  const testData: IstioConfigList = {
    namespace: {
      name: 'test'
    },
    gateways: [],
    virtualServices: { items: [], permissions: { create: false, update: false, delete: false } },
    destinationRules: { items: [], permissions: { create: false, update: false, delete: false } },
    serviceEntries: [],
    authorizationPolicies: [],
    sidecars: [],
    peerAuthentications: [],
    requestAuthentications: [],
    workloadEntries: [],
    workloadGroups: [],
    envoyFilters: [],
    validations: {},
    permissions: {}
  };
  names.forEach(name => {
    testData.authorizationPolicies.push({ metadata: { name: name + '0' }, spec: {} });
    testData.destinationRules.items.push({ metadata: { name: name + '1' }, spec: {} });
    testData.gateways.push({ metadata: { name: name + '2' }, spec: {} });
    testData.serviceEntries.push({ metadata: { name: name + '3' }, spec: {} });
    testData.virtualServices.items.push({ metadata: { name: name + '4' }, spec: {} });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigListContainer#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(2);
    expect(filtered.virtualServices.items.length).toBe(2);
    expect(filtered.destinationRules.items.length).toBe(2);
    expect(filtered.serviceEntries.length).toBe(2);

    expect(filtered.authorizationPolicies[0].metadata.name).toBe('white0');
    expect(filtered.destinationRules.items[0].metadata.name).toBe('white1');
    expect(filtered.serviceEntries[0].metadata.name).toBe('white3');
    expect(filtered.virtualServices.items[0].metadata.name).toBe('white4');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(0);
    expect(filtered.virtualServices.items.length).toBe(0);
    expect(filtered.destinationRules.items.length).toBe(0);
    expect(filtered.serviceEntries.length).toBe(0);
  });
});

describe('IstioConfigListContainer#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    const istioItems = toIstioItems(unfiltered);

    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(15);
    expect(istioItems[0].gateway).toBeDefined();
    expect(istioItems[0].destinationRule).toBeUndefined();
    expect(istioItems[3].virtualService).toBeDefined();
    expect(istioItems[3].destinationRule).toBeUndefined();
    expect(istioItems[6].virtualService).toBeUndefined();
    expect(istioItems[6].destinationRule).toBeDefined();
  });
});

describe('IstioConfigComponent#sortIstioItems', () => {
  it('should sort IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = true;

    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(15);

      const first = sorted[0];
      expect(first.authorizationPolicy).toBeDefined();
      expect(first.authorizationPolicy!.metadata.name).toBe('blue0');

      const second = sorted[1];
      expect(second.destinationRule).toBeDefined();
      expect(second.destinationRule!.metadata.name).toBe('blue1');

      const last = sorted[14];
      expect(last.virtualService).toBeDefined();
      expect(last.virtualService!.metadata.name).toBe('white4');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = false;

    // Descending
    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(15);

      const first = sorted[0];
      expect(first.virtualService).toBeDefined();
      expect(first.virtualService!.metadata.name).toBe('white4');

      const last = sorted[14];
      expect(last.authorizationPolicy).toBeDefined();
      expect(last.authorizationPolicy!.metadata.name).toBe('blue0');
    });
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = true;

    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(15);

      const first = sorted[0];
      expect(first.authorizationPolicy).toBeDefined();
      expect(first.authorizationPolicy!.metadata.name).toBe('blue0');

      const second = sorted[3];
      expect(second.destinationRule).toBeDefined();
      expect(second.destinationRule!.metadata.name).toBe('blue1');

      const last = sorted[14];
      expect(last.virtualService).toBeDefined();
      expect(last.virtualService!.metadata.name).toBe('white4');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = false;

    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(15);

      const first = sorted[0];
      expect(first.virtualService).toBeDefined();
      expect(first.virtualService!.metadata.name).toBe('white4');
    });
  });
});
