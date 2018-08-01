import {
  filterByName,
  IstioConfigList,
  SortField,
  sortIstioItems,
  toIstioItems
} from '../../../types/IstioConfigListComponent';

const mockIstioConfigList = (names: string[]): IstioConfigList => {
  let testData: IstioConfigList = {
    namespace: {
      name: 'test'
    },
    gateways: [],
    virtualServices: [],
    destinationRules: [],
    serviceEntries: [],
    rules: [],
    quotaSpecs: [],
    quotaSpecBindings: []
  };
  names.forEach(name => {
    testData.gateways.push({ name: name + '0', createdAt: 't0', resourceVersion: 'r0' });
    testData.virtualServices.push({ name: name + '1', createdAt: 't1', resourceVersion: 'r1' });
    testData.destinationRules.push({ name: name + '2', createdAt: 't2', resourceVersion: 'r2' });
    testData.serviceEntries.push({ name: name + '3', createdAt: 't3', resourceVersion: 'r3' });
    testData.rules.push({ name: name + '4', match: '', actions: [] });
    testData.quotaSpecs.push({ name: name + '5', createdAt: 't5', resourceVersion: 'r5' });
    testData.quotaSpecBindings.push({ name: name + '6', createdAt: 't6', resourceVersion: 'r6' });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigListComponent#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(2);
    expect(filtered.virtualServices.length).toBe(2);
    expect(filtered.destinationRules.length).toBe(2);
    expect(filtered.serviceEntries.length).toBe(2);
    expect(filtered.rules.length).toBe(2);
    expect(filtered.quotaSpecs.length).toBe(2);
    expect(filtered.quotaSpecBindings.length).toBe(2);

    expect(filtered.virtualServices[0].name).toBe('white1');
    expect(filtered.destinationRules[0].name).toBe('white2');
    expect(filtered.serviceEntries[0].name).toBe('white3');
    expect(filtered.rules[0].name).toBe('white4');
    expect(filtered.quotaSpecs[0].name).toBe('white5');
    expect(filtered.quotaSpecBindings[0].name).toBe('white6');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.gateways.length).toBe(0);
    expect(filtered.virtualServices.length).toBe(0);
    expect(filtered.destinationRules.length).toBe(0);
    expect(filtered.serviceEntries.length).toBe(0);
    expect(filtered.rules.length).toBe(0);
    expect(filtered.quotaSpecs.length).toBe(0);
    expect(filtered.quotaSpecBindings.length).toBe(0);
  });
});

describe('IstioConfigListComponent#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    let istioItems = toIstioItems(unfiltered);
    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(21);
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
    let istioItems = toIstioItems(unfiltered);
    let sortField: SortField = {
      id: 'istioname',
      title: 'Istio Name',
      isNumeric: false,
      param: 'in'
    };
    let isAscending = true;
    let sorted = sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(21);
    let first = sorted[0];
    expect(first.gateway).toBeDefined();
    expect(first.gateway!.name).toBe('blue0');
    let second = sorted[1];
    expect(second.virtualService).toBeDefined();
    expect(second.virtualService!.name).toBe('blue1');
    let last = sorted[20];
    expect(last.quotaSpecBinding).toBeDefined();
    expect(last.quotaSpecBinding!.name).toBe('white6');

    // Descending
    sorted = sortIstioItems(istioItems, sortField, !isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(21);
    first = sorted[0];
    expect(first.quotaSpecBinding).toBeDefined();
    expect(first.quotaSpecBinding!.name).toBe('white6');
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    let istioItems = toIstioItems(unfiltered);
    let sortField: SortField = {
      id: 'istiotype',
      title: 'Istio Type',
      isNumeric: false,
      param: 'it'
    };
    let isAscending = true;
    let sorted = sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(21);
    let first = sorted[0];
    expect(first.destinationRule).toBeDefined();
    expect(first.destinationRule!.name).toBe('blue2');
    let second = sorted[1];
    expect(second.destinationRule).toBeDefined();
    expect(second.destinationRule!.name).toBe('red2');
    let last = sorted[20];
    expect(last.virtualService).toBeDefined();
    expect(last.virtualService!.name).toBe('white1');

    // Descending
    sorted = sortIstioItems(istioItems, sortField, !isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(21);
    first = sorted[0];
    expect(first.virtualService).toBeDefined();
    expect(first.virtualService!.name).toBe('white1');
  });
});
