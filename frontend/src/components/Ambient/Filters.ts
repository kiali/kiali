import { FILTER_ACTION_APPEND, AllFilterTypes, FilterValue, RunnableFilter } from 'types/Filters';
import { ZtunnelService, ZtunnelWorkload } from 'types/IstioObjects';

const byNamespaces = (namespaces: FilterValue[]): RunnableFilter<ZtunnelService | ZtunnelWorkload> => {
  return {
    category: 'Namespaces',
    placeholder: 'Filter by Namespace',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: namespaces,
    run: (item, filters) => filters.filters.some(f => f.value === item.namespace)
  };
};

const byServices = (services: FilterValue[]): RunnableFilter<ZtunnelService | ZtunnelWorkload> => {
  return {
    category: 'Services',
    placeholder: 'Filter by Service',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: services,
    run: (item, filters) => filters.filters.some(f => f.value === item.services)
  };
};

export const ztunnelServiceFilters = (spans: ZtunnelService[]): RunnableFilter<ZtunnelService>[] => {
  const namespace = new Set<string>();
  const services = new Set<string>();
  spans.forEach(s => {
    namespace.add(s.namespace);
    services.add(s.services);
  });
  return [
    byNamespaces(Array.from(namespace).map(w => ({ id: w, title: w }))),
    byServices(Array.from(services).map(w => ({ id: w, title: w })))
  ];
};

export const ztunnelWorkloadFilters = (spans: ZtunnelWorkload[]): RunnableFilter<ZtunnelWorkload>[] => {
  const namespace = new Set<string>();
  const services = new Set<string>();
  spans.forEach(s => {
    namespace.add(s.namespace);
    services.add(s.services);
  });

  return [
    byNamespaces(Array.from(namespace).map(w => ({ id: w, title: w }))),
    byServices(Array.from(services).map(w => ({ id: w, title: w })))
  ];
};
