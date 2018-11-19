import { filterByName, IstioConfigItem, IstioConfigList, toIstioItems } from '../../../types/IstioConfigList';
import { IstioConfigListFilters } from '../FiltersAndSorts';
import { SortField } from '../../../types/SortFilters';

const mockIstioConfigList = (names: string[]): IstioConfigList => {
  let testData: IstioConfigList = {
    namespace: {
      name: 'test'
    },
    gateways: [],
    virtualServices: { items: [], permissions: { update: false, delete: false } },
    destinationRules: { items: [], permissions: { update: false, delete: false } },
    serviceEntries: [],
    rules: [],
    adapters: [],
    templates: [],
    quotaSpecs: [],
    quotaSpecBindings: [],
    permissions: {}
  };
  names.forEach(name => {
    testData.gateways.push({ name: name + '0', createdAt: 't0', resourceVersion: 'r0' });
    testData.virtualServices.items.push({ name: name + '1', createdAt: 't1', resourceVersion: 'r1' });
    testData.destinationRules.items.push({ name: name + '2', createdAt: 't2', resourceVersion: 'r2' });
    testData.serviceEntries.push({ name: name + '3', createdAt: 't3', resourceVersion: 'r3' });
    testData.rules.push({ name: name + '4', createdAt: 't4', resourceVersion: 'r4', match: '', actions: [] });
    testData.adapters.push({
      name: name + '5',
      createdAt: 't5',
      resourceVersion: 'r5',
      adapter: name + '5',
      adapters: name + '5',
      spec: ''
    });
    testData.templates.push({
      name: name + '6',
      createdAt: 't6',
      resourceVersion: 'r6',
      template: name + '6',
      templates: name + '6',
      spec: ''
    });
    testData.quotaSpecs.push({ name: name + '7', createdAt: 't7', resourceVersion: 'r7' });
    testData.quotaSpecBindings.push({ name: name + '8', createdAt: 't8', resourceVersion: 'r8' });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigListComponent#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(2);
    expect(filtered.virtualServices.items.length).toBe(2);
    expect(filtered.destinationRules.items.length).toBe(2);
    expect(filtered.serviceEntries.length).toBe(2);
    expect(filtered.rules.length).toBe(2);
    expect(filtered.adapters.length).toBe(2);
    expect(filtered.templates.length).toBe(2);
    expect(filtered.quotaSpecs.length).toBe(2);
    expect(filtered.quotaSpecBindings.length).toBe(2);

    expect(filtered.virtualServices.items[0].name).toBe('white1');
    expect(filtered.destinationRules.items[0].name).toBe('white2');
    expect(filtered.serviceEntries[0].name).toBe('white3');
    expect(filtered.rules[0].name).toBe('white4');
    expect(filtered.adapters[0].name).toBe('white5');
    expect(filtered.templates[0].name).toBe('white6');
    expect(filtered.quotaSpecs[0].name).toBe('white7');
    expect(filtered.quotaSpecBindings[0].name).toBe('white8');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(0);
    expect(filtered.virtualServices.items.length).toBe(0);
    expect(filtered.destinationRules.items.length).toBe(0);
    expect(filtered.serviceEntries.length).toBe(0);
    expect(filtered.rules.length).toBe(0);
    expect(filtered.adapters.length).toBe(0);
    expect(filtered.templates.length).toBe(0);
    expect(filtered.quotaSpecs.length).toBe(0);
    expect(filtered.quotaSpecBindings.length).toBe(0);
  });
});

describe('IstioConfigListComponent#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    const istioItems = toIstioItems(unfiltered);

    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(27);
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

    IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(27);

      const first = sorted[0];
      expect(first.gateway).toBeDefined();
      expect(first.gateway!.name).toBe('blue0');

      const second = sorted[1];
      expect(second.virtualService).toBeDefined();
      expect(second.virtualService!.name).toBe('blue1');

      const last = sorted[26];
      expect(last.quotaSpecBinding).toBeDefined();
      expect(last.quotaSpecBinding!.name).toBe('white8');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = false;

    // Descending
    IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(27);

      const first = sorted[0];
      expect(first.quotaSpecBinding).toBeDefined();
      expect(first.quotaSpecBinding!.name).toBe('white8');

      const last = sorted[26];
      expect(last.gateway).toBeDefined();
      expect(last.gateway!.name).toBe('blue0');
    });
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = true;

    IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(27);

      const first = sorted[0];
      expect(first.adapter).toBeDefined();
      expect(first.adapter!.name).toBe('blue5');

      const second = sorted[3];
      expect(second.destinationRule).toBeDefined();
      expect(second.destinationRule!.name).toBe('blue2');

      const last = sorted[26];
      expect(last.virtualService).toBeDefined();
      expect(last.virtualService!.name).toBe('white1');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = false;

    IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(27);

      const first = sorted[0];
      expect(first.virtualService).toBeDefined();
      expect(first.virtualService!.name).toBe('white1');
    });
  });
});
