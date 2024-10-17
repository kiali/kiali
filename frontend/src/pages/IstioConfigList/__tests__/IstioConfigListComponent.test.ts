import {
  dicIstioTypeToGVK,
  filterByName,
  IstioConfigItem,
  IstioConfigList,
  toIstioItems
} from '../../../types/IstioConfigList';
import * as IstioConfigListFilters from '../FiltersAndSorts';
import { SortField } from '../../../types/SortFilters';
import { gvkToString } from '../../../utils/IstioConfigUtils';

const mockIstioConfigList = (names: string[]): IstioConfigList => {
  const testData: IstioConfigList = {
    validations: {},
    permissions: {},
    resources: {}
  };
  Object.keys(dicIstioTypeToGVK).forEach(index => {
    const key = gvkToString(dicIstioTypeToGVK[index]);
    testData.resources[key] = [];
  });
  names.forEach(name => {
    testData.resources[gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])].push({
      metadata: { name: `${name}0` },
      spec: {},
      kind: dicIstioTypeToGVK['AuthorizationPolicy'].Kind,
      apiVersion: `${dicIstioTypeToGVK['AuthorizationPolicy'].Group}/${dicIstioTypeToGVK['AuthorizationPolicy'].Version}`
    });
    testData.resources[gvkToString(dicIstioTypeToGVK['DestinationRule'])].push({
      metadata: { name: `${name}1` },
      spec: {},
      kind: dicIstioTypeToGVK['DestinationRule'].Kind,
      apiVersion: `${dicIstioTypeToGVK['DestinationRule'].Group}/${dicIstioTypeToGVK['DestinationRule'].Version}`
    });
    testData.resources[gvkToString(dicIstioTypeToGVK['Gateway'])].push({
      metadata: { name: `${name}2` },
      spec: {},
      kind: dicIstioTypeToGVK['Gateway'].Kind,
      apiVersion: `${dicIstioTypeToGVK['Gateway'].Group}/${dicIstioTypeToGVK['Gateway'].Version}`
    });
    testData.resources[gvkToString(dicIstioTypeToGVK['ServiceEntry'])].push({
      metadata: { name: `${name}3` },
      spec: {},
      kind: dicIstioTypeToGVK['ServiceEntry'].Kind,
      apiVersion: `${dicIstioTypeToGVK['ServiceEntry'].Group}/${dicIstioTypeToGVK['ServiceEntry'].Version}`
    });
    testData.resources[gvkToString(dicIstioTypeToGVK['VirtualService'])].push({
      metadata: { name: `${name}4` },
      spec: {},
      kind: dicIstioTypeToGVK['VirtualService'].Kind,
      apiVersion: `${dicIstioTypeToGVK['VirtualService'].Group}/${dicIstioTypeToGVK['VirtualService'].Version}`
    });
  });
  return testData;
};

const unfiltered = mockIstioConfigList(['white', 'red', 'blue']);

describe('IstioConfigList#filterByName', () => {
  it('should filter IstioConfigList by name', () => {
    let filtered = filterByName(unfiltered, ['white', 'red']);
    expect(filtered).toBeDefined();
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['Gateway'])].length).toBe(2);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['VirtualService'])].length).toBe(2);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['DestinationRule'])].length).toBe(2);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['ServiceEntry'])].length).toBe(2);

    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])][0].metadata.name).toBe('white0');
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['DestinationRule'])][0].metadata.name).toBe('white1');
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['ServiceEntry'])][0].metadata.name).toBe('white3');
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['VirtualService'])][0].metadata.name).toBe('white4');

    filtered = filterByName(unfiltered, ['bad']);
    expect(filtered).toBeDefined();
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['Gateway'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['VirtualService'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['DestinationRule'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['ServiceEntry'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['WasmPlugin'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['Telemetry'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sGateway'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sGRPCRoute'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sHTTPRoute'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sReferenceGrant'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sTCPRoute'])].length).toBe(0);
    expect(filtered.resources[gvkToString(dicIstioTypeToGVK['K8sTLSRoute'])].length).toBe(0);
  });
});

describe('IstioConfigListContainer#toIstioItems', () => {
  it('should convert IstioConfigList in IstioConfigItems', () => {
    const istioItems = toIstioItems(unfiltered);

    expect(istioItems).toBeDefined();
    expect(istioItems.length).toBe(15);
    expect(istioItems[0].resource).toBeDefined();
    expect(istioItems[0].resource.kind).toBe(dicIstioTypeToGVK['AuthorizationPolicy'].Kind);
    expect(istioItems[3].resource).toBeDefined();
    expect(istioItems[3].resource.kind).toBe(dicIstioTypeToGVK['DestinationRule'].Kind);
    expect(istioItems[6].resource).toBeDefined();
    expect(istioItems[6].resource.kind).toBe(dicIstioTypeToGVK['Gateway'].Kind);
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
    expect(first.resource.kind).toBe(dicIstioTypeToGVK['AuthorizationPolicy'].Kind);
    expect(first.resource.metadata.name).toBe('blue0');

    const second = sorted[1];
    expect(second.resource).toBeDefined();
    expect(second.resource.kind).toBe(dicIstioTypeToGVK['DestinationRule'].Kind);
    expect(second.resource.metadata.name).toBe('blue1');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicIstioTypeToGVK['VirtualService'].Kind);
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
    expect(first.resource.kind).toBe(dicIstioTypeToGVK['VirtualService'].Kind);
    expect(first.resource.metadata.name).toBe('white4');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicIstioTypeToGVK['AuthorizationPolicy'].Kind);
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
    expect(first.resource.kind).toBe(dicIstioTypeToGVK['AuthorizationPolicy'].Kind);
    expect(first.resource.metadata.name).toBe('blue0');

    const second = sorted[3];
    expect(second.resource).toBeDefined();
    expect(second.resource.kind).toBe(dicIstioTypeToGVK['DestinationRule'].Kind);
    expect(second.resource.metadata.name).toBe('blue1');

    const last = sorted[14];
    expect(last.resource).toBeDefined();
    expect(last.resource.kind).toBe(dicIstioTypeToGVK['VirtualService'].Kind);
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
    expect(first.resource.kind).toBe(dicIstioTypeToGVK['VirtualService'].Kind);
    expect(first.resource.metadata.name).toBe('white4');
  });
});
