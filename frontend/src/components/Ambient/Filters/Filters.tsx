import { FILTER_ACTION_APPEND, AllFilterTypes, FilterValue, RunnableFilter } from 'types/Filters';
import {
  ZtunnelConfigDump,
  ZtunnelEndpoint,
  ZtunnelItem,
  ZtunnelService,
  ZtunnelWorkload
} from '../../../types/IstioObjects';

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

const byWaypointService = (services: FilterValue[]): RunnableFilter<ZtunnelService> => {
  return {
    category: 'Waypoint',
    placeholder: 'Filter by Waypoint',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: services,
    run: (services, filters) =>
      filters.filters.some(f => {
        return f.value === 'None' ? services.waypoint.destination === '' : f.value === services.waypoint.destination;
      })
  };
};

const byUnhealthy = (services: FilterValue[]): RunnableFilter<ZtunnelService> => {
  return {
    category: 'Endpoints Health',
    placeholder: 'Filter by Endpoints',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: services,
    run: (services, filters) =>
      filters.filters.some(f => {
        return Object.values(services.endpoints).some(e => {
          return e.status.toLowerCase() === f.value.toLowerCase();
        });
      })
  };
};

const byNode = (workloads: FilterValue[]): RunnableFilter<ZtunnelWorkload> => {
  return {
    category: 'Node',
    placeholder: 'Filter by Node',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: workloads,
    run: (workloads, filters) => filters.filters.some(f => f.value === workloads.node)
  };
};

const byProtocol = (workloads: FilterValue[]): RunnableFilter<ZtunnelWorkload> => {
  return {
    category: 'Protocol',
    placeholder: 'Filter by Protocol',
    filterType: AllFilterTypes.typeAhead,
    action: FILTER_ACTION_APPEND,
    filterValues: workloads,
    run: (workloads, filters) => filters.filters.some(f => f.value === workloads.protocol)
  };
};

export const servicesFilters = (config: ZtunnelConfigDump): RunnableFilter<ZtunnelService>[] => {
  const name = new Set<string>();
  const namespace = new Set<string>();
  const waypoint = new Set<string>();
  const unhealthy = new Set<string>();

  config?.services?.forEach(s => {
    name.add(s.name);
    namespace.add(s.namespace);
    waypoint.add(s.waypoint.destination);
    unhealthy.add(getWorstStatus(s.endpoints));
  });

  return [
    byName(
      Array.from(name).map(w => ({ id: w, title: w })),
      'Service'
    ),
    byNamespace(Array.from(namespace).map(w => ({ id: w, title: w }))),
    byWaypointService(Array.from(waypoint).map(w => ({ id: w, title: w !== '' ? w : 'None' }))),
    byUnhealthy(Array.from(unhealthy).map(w => ({ id: w.toString(), title: w.toString() })))
  ];
};

const getWorstStatus = (endpoints: Record<string, ZtunnelEndpoint>): string => {
  const anyUnhealthy = Object.values(endpoints).find(e => e.status.toLowerCase() !== 'healthy');
  return anyUnhealthy ? anyUnhealthy[0].status : 'Healthy';
};

export const workloadsFilters = (config: ZtunnelConfigDump): RunnableFilter<ZtunnelWorkload>[] => {
  const name = new Set<string>();
  const namespace = new Set<string>();
  const node = new Set<string>();
  const protocol = new Set<string>();

  config?.workloads?.forEach(s => {
    name.add(s.name);
    namespace.add(s.namespace);
    node.add(s.node);
    protocol.add(s.protocol);
  });

  return [
    byName(
      Array.from(name).map(w => ({ id: w, title: w })),
      'Pod Name'
    ),
    byNamespace(Array.from(namespace).map(w => ({ id: w, title: w }))),
    byNode(Array.from(node).map(w => ({ id: w, title: w }))),
    byProtocol(Array.from(protocol).map(w => ({ id: w, title: w })))
  ];
};
