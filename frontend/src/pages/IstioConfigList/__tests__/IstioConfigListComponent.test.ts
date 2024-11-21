import {
  dicTypeToGVK,
  filterByName,
  gvkType,
  IstioConfigItem,
  IstioConfigList,
  toIstioItems
} from '../../../types/IstioConfigList';
import * as IstioConfigListFilters from '../FiltersAndSorts';
import { SortField } from '../../../types/SortFilters';
import { getGVKTypeString } from '../../../utils/IstioConfigUtils';

const mockIstioConfigList = (names: string[]): IstioConfigList => {
  const testData: IstioConfigList = {
    validations: {},
    permissions: {},
    resources: {}
  };
  Object.values(dicTypeToGVK).forEach(index => {
    const key = getGVKTypeString(index);
    testData.resources[key] = [];
  });
  names.forEach(name => {
    testData.resources[getGVKTypeString(gvkType.AuthorizationPolicy)].push({
      metadata: { name: `${name}0` },
      spec: {},
      kind: dicTypeToGVK[gvkType.AuthorizationPolicy].Kind,
      apiVersion: `${dicTypeToGVK[gvkType.AuthorizationPolicy].Group}/${
        dicTypeToGVK[gvkType.AuthorizationPolicy].Version
      }`
    });
    testData.resources[getGVKTypeString(gvkType.DestinationRule)].push({
      metadata: { name: `${name}1` },
      spec: {},
      kind: dicTypeToGVK[gvkType.DestinationRule].Kind,
      apiVersion: `${dicTypeToGVK[gvkType.DestinationRule].Group}/${dicTypeToGVK[gvkType.DestinationRule].Version}`
    });
    testData.resources[getGVKTypeString(gvkType.Gateway)].push({
      metadata: { name: `${name}2` },
      spec: {},
      kind: dicTypeToGVK[gvkType.Gateway].Kind,
      apiVersion: `${dicTypeToGVK[gvkType.Gateway].Group}/${dicTypeToGVK[gvkType.Gateway].Version}`
    });
    testData.resources[getGVKTypeString(gvkType.ServiceEntry)].push({
      metadata: { name: `${name}3` },
      spec: {},
      kind: dicTypeToGVK[gvkType.ServiceEntry].Kind,
      apiVersion: `${dicTypeToGVK[gvkType.ServiceEntry].Group}/${dicTypeToGVK[gvkType.ServiceEntry].Version}`
    });
    testData.resources[getGVKTypeString(gvkType.VirtualService)].push({
      metadata: { name: `${name}4` },
      spec: {},
      kind: dicTypeToGVK[gvkType.VirtualService].Kind,
      apiVersion: `${dicTypeToGVK[gvkType.VirtualService].Group}/${dicTypeToGVK[gvkType.VirtualService].Version}`
    });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigList#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.resources[getGVKTypeString(gvkType.Gateway)].length).toBe(2);
    expect(filtered.resources[getGVKTypeString(gvkType.VirtualService)].length).toBe(2);
    expect(filtered.resources[getGVKTypeString(gvkType.DestinationRule)].length).toBe(2);
    expect(filtered.resources[getGVKTypeString(gvkType.ServiceEntry)].length).toBe(2);

    expect(filtered.resources[getGVKTypeString(gvkType.AuthorizationPolicy)][0].metadata.name).toBe('white0');
    expect(filtered.resources[getGVKTypeString(gvkType.DestinationRule)][0].metadata.name).toBe('white1');
    expect(filtered.resources[getGVKTypeString(gvkType.ServiceEntry)][0].metadata.name).toBe('white3');
    expect(filtered.resources[getGVKTypeString(gvkType.VirtualService)][0].metadata.name).toBe('white4');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.resources[getGVKTypeString(gvkType.Gateway)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.VirtualService)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.DestinationRule)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.ServiceEntry)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.WasmPlugin)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.Telemetry)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sGateway)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sGRPCRoute)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sHTTPRoute)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sReferenceGrant)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sTCPRoute)].length).toBe(0);
    expect(filtered.resources[getGVKTypeString(gvkType.K8sTLSRoute)].length).toBe(0);
  });
});

describe('IstioConfigListContainer#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    const istioItems = toIstioItems(unfiltered);

    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(15);
    expect(istioItems[0].resource).toBeDefined();
    expect(istioItems[0].resource.kind).toBe(dicTypeToGVK[gvkType.AuthorizationPolicy].Kind);
    expect(istioItems[3].resource).toBeDefined();
    expect(istioItems[3].resource.kind).toBe(dicTypeToGVK[gvkType.DestinationRule].Kind);
    expect(istioItems[6].resource).toBeDefined();
    expect(istioItems[6].resource.kind).toBe(dicTypeToGVK[gvkType.Gateway].Kind);
  });
});

describe('IstioConfigComponent#sortIstioItems', () => {
  it('should sort IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = true;

    const sorted = IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);

    const first = sorted[0];
    expect(first.resource).toBeDefined();
    expect(first.resource.kind).toBe(dicTypeToGVK[gvkType.AuthorizationPolicy].Kind);
    expect(first.resource.metadata.name).toBe('blue0');

    const second = sorted[1];
    expect(second.resource).toBeDefined();
    expect(second.resource.kind).toBe(dicTypeToGVK[gvkType.DestinationRule].Kind);
    expect(second.resource.metadata.name).toBe('blue1');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicTypeToGVK[gvkType.VirtualService].Kind);
    expect(last.resource.metadata.name).toBe('white4');
  });

  it('should sort DESC IstioConfigItems by Istio Name', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[2];
    const isAscending = false;

    // Descending
    const sorted = IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);

    const first = sorted[0];
    expect(first.resource).toBeDefined();
    expect(first.resource.kind).toBe(dicTypeToGVK[gvkType.VirtualService].Kind);
    expect(first.resource.metadata.name).toBe('white4');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicTypeToGVK[gvkType.AuthorizationPolicy].Kind);
    expect(last.resource.metadata.name).toBe('blue0');
  });

  it('should sort IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = true;

    const sorted = IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);

    const first = sorted[0];
    expect(first.resource).toBeDefined();
    expect(first.resource.kind).toBe(dicTypeToGVK[gvkType.AuthorizationPolicy].Kind);
    expect(first.resource.metadata.name).toBe('blue0');

    const second = sorted[3];
    expect(second.resource).toBeDefined();
    expect(second.resource.kind).toBe(dicTypeToGVK[gvkType.DestinationRule].Kind);
    expect(second.resource.metadata.name).toBe('blue1');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicTypeToGVK[gvkType.VirtualService].Kind);
    expect(last.resource.metadata.name).toBe('white4');
  });

  it('should sort DESC IstioConfigItems by Istio Type', () => {
    const istioItems = toIstioItems(unfiltered);
    const sortField: SortField<IstioConfigItem> = IstioConfigListFilters.sortFields[1];
    const isAscending = false;

    const sorted = IstioConfigListFilters.sortIstioItems(istioItems, sortField, isAscending);
    expect(sorted).toBeDefined();
    expect(sorted.length).toBe(15);

    const first = sorted[0];
    expect(first.resource).toBeDefined();
    expect(first.resource.kind).toBe(dicTypeToGVK[gvkType.VirtualService].Kind);
    expect(first.resource.metadata.name).toBe('white4');
  });
});
