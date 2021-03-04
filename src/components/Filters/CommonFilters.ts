import {
  FILTER_ACTION_APPEND,
  FilterType,
  FILTER_ACTION_UPDATE,
  FilterValue,
  ActiveFiltersInfo,
  FilterTypes
} from '../../types/Filters';
import { HEALTHY, DEGRADED, FAILURE, NA, NOT_READY, Health } from '../../types/Health';
import { removeDuplicatesArray } from '../../utils/Common';

export const presenceValues: FilterValue[] = [
  {
    id: 'present',
    title: 'Present'
  },
  {
    id: 'notpresent',
    title: 'Not Present'
  }
];

export const istioSidecarFilter: FilterType = {
  id: 'istiosidecar',
  title: 'Istio Sidecar',
  placeholder: 'Filter by IstioSidecar Validation',
  filterType: FilterTypes.select,
  action: FILTER_ACTION_UPDATE,
  filterValues: presenceValues
};

export const healthFilter: FilterType = {
  id: 'health',
  title: 'Health',
  placeholder: 'Filter by Health',
  filterType: FilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: HEALTHY.name,
      title: HEALTHY.name
    },
    {
      id: DEGRADED.name,
      title: DEGRADED.name
    },
    {
      id: FAILURE.name,
      title: FAILURE.name
    },
    {
      id: NOT_READY.name,
      title: NOT_READY.name
    },
    {
      id: 'na',
      title: NA.name
    }
  ]
};

export const labelFilter: FilterType = {
  id: 'label',
  title: 'Label',
  placeholder: 'Filter by Label',
  filterType: FilterTypes.label,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const getFilterSelectedValues = (filter: FilterType, activeFilters: ActiveFiltersInfo): string[] => {
  const selected: string[] = activeFilters.filters
    .filter(activeFilter => activeFilter.id === filter.id)
    .map(activeFilter => activeFilter.value);
  return removeDuplicatesArray(selected);
};

export const getPresenceFilterValue = (filter: FilterType, activeFilters: ActiveFiltersInfo): boolean | undefined => {
  const presenceFilters = activeFilters.filters.filter(activeFilter => activeFilter.id === filter.id);

  if (presenceFilters.length > 0) {
    return presenceFilters[0].value === 'Present';
  }
  return undefined;
};

export const filterByHealth = <T extends { healthPromise: Promise<Health> }>(
  items: T[],
  filterValues: string[]
): Promise<T[]> => {
  const itemsWithHealthPromises = items.map(item => item.healthPromise.then(h => ({ health: h, item: item })));
  return Promise.all(itemsWithHealthPromises).then(itemsWithHealth => {
    return itemsWithHealth
      .filter(itemWithHealth => filterValues.includes(itemWithHealth.health.getGlobalStatus().name))
      .map(itemWithHealth => itemWithHealth.item);
  });
};
