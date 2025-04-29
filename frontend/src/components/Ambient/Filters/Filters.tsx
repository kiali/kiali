import { FILTER_ACTION_APPEND, AllFilterTypes, FilterValue, RunnableFilter } from 'types/Filters';
import { ZtunnelConfigDump, ZtunnelItem, ZtunnelService, ZtunnelWorkload } from '../../../types/IstioObjects';
import { ConfigType } from './ZtunnelLabels';

const byName = (item: FilterValue[], type: ConfigType): RunnableFilter<ZtunnelItem> => {
  return {
    category: type,
    placeholder: `Filter by ${type}`,
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
      ConfigType.SERVICE
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
      ConfigType.WORKLOAD
    ),
    byNamespace(Array.from(namespace).map(w => ({ id: w, title: w })))
  ];
};
