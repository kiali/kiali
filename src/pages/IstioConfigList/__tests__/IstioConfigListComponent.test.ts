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
    route_rules: [],
    destination_policies: [],
    virtual_services: [],
    destination_rules: [],
    rules: []
  };
  names.forEach(name => {
    testData.route_rules.push({ name: name + '1', created_at: 't1', resource_version: 'r1' });
    testData.destination_policies.push({ name: name + '2', created_at: 't2', resource_version: 'r2' });
    testData.virtual_services.push({ name: name + '3', created_at: 't3', resource_version: 'r3' });
    testData.destination_rules.push({ name: name + '4', created_at: 't4', resource_version: 'r4' });
    testData.rules.push({ name: name + '5', match: '', actions: [] });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigListComponent#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.route_rules.length).toBe(2);
    expect(filtered.destination_policies.length).toBe(2);
    expect(filtered.virtual_services.length).toBe(2);
    expect(filtered.destination_rules.length).toBe(2);
    expect(filtered.rules.length).toBe(2);
    expect(filtered.route_rules[0].name).toBe('white1');
    expect(filtered.destination_policies[0].name).toBe('white2');
    expect(filtered.virtual_services[0].name).toBe('white3');
    expect(filtered.destination_rules[0].name).toBe('white4');
    expect(filtered.rules[0].name).toBe('white5');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.route_rules.length).toBe(0);
    expect(filtered.destination_policies.length).toBe(0);
    expect(filtered.virtual_services.length).toBe(0);
    expect(filtered.destination_rules.length).toBe(0);
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
