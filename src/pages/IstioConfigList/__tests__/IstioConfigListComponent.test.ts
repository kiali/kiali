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
    routeRules: [],
    destinationPolicies: [],
    virtualServices: [],
    destinationRules: [],
    rules: []
  };
  names.forEach(name => {
    testData.routeRules.push({ name: name + '1', createdAt: 't1', resourceVersion: 'r1' });
    testData.destinationPolicies.push({ name: name + '2', createdAt: 't2', resourceVersion: 'r2' });
    testData.virtualServices.push({ name: name + '3', createdAt: 't3', resourceVersion: 'r3' });
    testData.destinationRules.push({ name: name + '4', createdAt: 't4', resourceVersion: 'r4' });
    testData.rules.push({ name: name + '5', match: '', actions: [] });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigListComponent#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.routeRules.length).toBe(2);
    expect(filtered.destinationPolicies.length).toBe(2);
    expect(filtered.virtualServices.length).toBe(2);
    expect(filtered.destinationRules.length).toBe(2);
    expect(filtered.rules.length).toBe(2);
    expect(filtered.routeRules[0].name).toBe('white1');
    expect(filtered.destinationPolicies[0].name).toBe('white2');
    expect(filtered.virtualServices[0].name).toBe('white3');
    expect(filtered.destinationRules[0].name).toBe('white4');
    expect(filtered.rules[0].name).toBe('white5');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.routeRules.length).toBe(0);
    expect(filtered.destinationPolicies.length).toBe(0);
    expect(filtered.virtualServices.length).toBe(0);
    expect(filtered.destinationRules.length).toBe(0);
    expect(filtered.rules.length).toBe(0);
  });
});

describe('IstioConfigListComponent#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    let istioItems = toIstioItems(unfiltered);
    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(15);
    expect(istioItems[0].routeRule).toBeDefined();
    expect(istioItems[0].destinationPolicy).toBeUndefined();
    expect(istioItems[3].routeRule).toBeUndefined();
    expect(istioItems[3].destinationPolicy).toBeDefined();
  });
});

describe('IstioConfigComponent#sortIstioItems', () => {
  it('should sort IstioConfigItems by Istio Name', () => {
    let istioItems = toIstioItems(unfiltered);
    let sortField: SortField = {
      id: 'istioname',
      title: 'Istio Name',
      isNumeric: false
    };
    let isAscending = true;
    let sorted = sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);
    let first = sorted[0];
    expect(first.routeRule).toBeDefined();
    expect(first.routeRule!.name).toBe('blue1');
    let second = sorted[1];
    expect(second.destinationPolicy).toBeDefined();
    expect(second.destinationPolicy!.name).toBe('blue2');
    let last = sorted[14];
    expect(last.rule).toBeDefined();
    expect(last.rule!.name).toBe('white5');

    // Descending
    sorted = sortIstioItems(istioItems, sortField, !isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);
    first = sorted[0];
    expect(first.rule).toBeDefined();
    expect(first.rule!.name).toBe('white5');
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    let istioItems = toIstioItems(unfiltered);
    let sortField: SortField = {
      id: 'istiotype',
      title: 'Istio Type',
      isNumeric: false
    };
    let isAscending = true;
    let sorted = sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);
    let first = sorted[0];
    expect(first.destinationPolicy).toBeDefined();
    expect(first.destinationPolicy!.name).toBe('blue2');
    let second = sorted[1];
    expect(second.destinationPolicy).toBeDefined();
    expect(second.destinationPolicy!.name).toBe('red2');
    let last = sorted[14];
    expect(last.virtualService).toBeDefined();
    expect(last.virtualService!.name).toBe('white3');

    // Descending
    sorted = sortIstioItems(istioItems, sortField, !isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);
    first = sorted[0];
    expect(first.virtualService).toBeDefined();
    expect(first.virtualService!.name).toBe('white3');
  });
});
