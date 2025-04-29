import { FILTER_ACTION_APPEND, AllFilterTypes, FilterValue, RunnableFilter } from 'types/Filters';
import { ZtunnelConfigDump, ZtunnelItem, ZtunnelService, ZtunnelWorkload } from '../../../types/IstioObjects';

const byName = (item: FilterValue[], name: string): RunnableFilter<ZtunnelItem> => {
  return {
    category: name,
    placeholder: `Filter by ${name}`,
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: item,
    run: (item, filters) => filters.filters.some(f => f.value === item.name)
  };
};

const byNamespace = (services: FilterValue[]): RunnableFilter<ZtunnelItem> => {
  return {
    category: 'Namespace',
    placeholder: 'Filter by Namespace',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: services,
    run: (services, filters) => filters.filters.some(f => f.value === services.namespace)
  };
};

export const servicesFilters = (config: ZtunnelConfigDump): RunnableFilter<ZtunnelService>[] => {
  const name = new Set<string>();
  const namespace = new Set<string>();

  config?.services?.forEach(s => {
    name.add(s.name);
    namespace.add(s.namespace);
  });

  return [
    byName(
      Array.from(name).map(w => ({ id: w, title: w })),
      'Service'
    ),
    byNamespace(Array.from(namespace).map(w => ({ id: w, title: w })))
  ];
};

export const workloadsFilters = (config: ZtunnelConfigDump): RunnableFilter<ZtunnelWorkload>[] => {
  const name = new Set<string>();
  const namespace = new Set<string>();

  config?.workloads?.forEach(s => {
    name.add(s.name);
    namespace.add(s.namespace);
  });

  return [
    byName(
      Array.from(name).map(w => ({ id: w, title: w })),
      'Pod Name'
    ),
    byNamespace(Array.from(namespace).map(w => ({ id: w, title: w })))
  ];
};
