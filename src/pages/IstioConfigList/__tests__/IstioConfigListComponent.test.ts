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
    rules: [],
    adapters: [],
    templates: [],
    quotaSpecs: [],
    quotaSpecBindings: [],
    policies: [],
    meshPolicies: [],
    clusterRbacConfigs: [],
    rbacConfigs: [],
    sidecars: [],
    serviceRoles: [],
    serviceRoleBindings: [],
    validations: {},
    permissions: {}
  };
  names.forEach(name => {
    testData.gateways.push({ metadata: { name: name + '0' }, spec: {} });
    testData.virtualServices.items.push({ metadata: { name: name + '1' }, spec: {} });
    testData.destinationRules.items.push({ metadata: { name: name + '2' }, spec: {} });
    testData.serviceEntries.push({ metadata: { name: name + '3' }, spec: {} });
    testData.rules.push({ metadata: { name: name + '4' }, spec: { match: '', actions: [] } });
    testData.adapters.push({
      metadata: { name: name + '5' },
      adapter: name + '5',
      adapters: name + '5',
      spec: ''
    });
    testData.templates.push({
      metadata: { name: name + '6' },
      template: name + '6',
      templates: name + '6',
      spec: ''
    });
    testData.quotaSpecs.push({ metadata: { name: name + '7' }, spec: {} });
    testData.quotaSpecBindings.push({ metadata: { name: name + '8' }, spec: {} });
    testData.policies.push({ metadata: { name: name + '9' }, spec: {} });
    testData.meshPolicies.push({ metadata: { name: name + '10' }, spec: {} });
    testData.clusterRbacConfigs.push({ metadata: { name: name + '11' }, spec: {} });
    testData.serviceRoles.push({ metadata: { name: name + '12' }, spec: {} });
    testData.serviceRoleBindings.push({ metadata: { name: name + '13' }, spec: {} });
    testData.rbacConfigs.push({ metadata: { name: name + '14' }, spec: {} });
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
    expect(filtered.rules.length).toBe(2);
    expect(filtered.adapters.length).toBe(2);
    expect(filtered.templates.length).toBe(2);
    expect(filtered.quotaSpecs.length).toBe(2);
    expect(filtered.quotaSpecBindings.length).toBe(2);
    expect(filtered.policies.length).toBe(2);
    expect(filtered.meshPolicies.length).toBe(2);
    expect(filtered.clusterRbacConfigs.length).toBe(2);
    expect(filtered.rbacConfigs.length).toBe(2);
    expect(filtered.serviceRoles.length).toBe(2);
    expect(filtered.serviceRoleBindings.length).toBe(2);

    expect(filtered.virtualServices.items[0].metadata.name).toBe('white1');
    expect(filtered.destinationRules.items[0].metadata.name).toBe('white2');
    expect(filtered.serviceEntries[0].metadata.name).toBe('white3');
    expect(filtered.rules[0].metadata.name).toBe('white4');
    expect(filtered.adapters[0].metadata.name).toBe('white5');
    expect(filtered.templates[0].metadata.name).toBe('white6');
    expect(filtered.quotaSpecs[0].metadata.name).toBe('white7');
    expect(filtered.quotaSpecBindings[0].metadata.name).toBe('white8');
    expect(filtered.policies[0].metadata.name).toBe('white9');
    expect(filtered.meshPolicies[0].metadata.name).toBe('white10');
    expect(filtered.clusterRbacConfigs[0].metadata.name).toBe('white11');
    expect(filtered.serviceRoles[0].metadata.name).toBe('white12');
    expect(filtered.serviceRoleBindings[0].metadata.name).toBe('white13');
    expect(filtered.rbacConfigs[0].metadata.name).toBe('white14');

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
    expect(filtered.policies.length).toBe(0);
    expect(filtered.meshPolicies.length).toBe(0);
    expect(filtered.clusterRbacConfigs.length).toBe(0);
    expect(filtered.serviceRoles.length).toBe(0);
  });
});

describe('IstioConfigListContainer#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    const istioItems = toIstioItems(unfiltered);

    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(45);
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
      expect(sorted.length).toBe(45);

      const first = sorted[0];
      expect(first.gateway).toBeDefined();
      expect(first.gateway!.metadata.name).toBe('blue0');

      const second = sorted[1];
      expect(second.virtualService).toBeDefined();
      expect(second.virtualService!.metadata.name).toBe('blue1');

      const last = sorted[44];
      expect(last.policy).toBeDefined();
      expect(last.policy!.metadata.name).toBe('white9');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = false;

    // Descending
    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(45);

      const first = sorted[0];
      expect(first.policy).toBeDefined();
      expect(first.policy!.metadata.name).toBe('white9');

      const last = sorted[44];
      expect(last.gateway).toBeDefined();
      expect(last.gateway!.metadata.name).toBe('blue0');
    });
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = true;

    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(45);

      const first = sorted[0];
      expect(first.adapter).toBeDefined();
      expect(first.adapter!.metadata.name).toBe('blue5');

      const second = sorted[3];
      expect(second.clusterRbacConfig).toBeDefined();
      expect(second.clusterRbacConfig!.metadata.name).toBe('blue11');

      const last = sorted[44];
      expect(last.virtualService).toBeDefined();
      expect(last.virtualService!.metadata.name).toBe('white1');
    });
  });

  it('should sort DESC IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = false;

    return IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending).then(sorted => {
      expect(sorted).toBeDefined();
      expect(sorted.length).toBe(45);

      const first = sorted[0];
      expect(first.virtualService).toBeDefined();
      expect(first.virtualService!.metadata.name).toBe('white1');
    });
  });
});
