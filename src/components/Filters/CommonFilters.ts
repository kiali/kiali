import { FILTER_ACTION_APPEND, FilterType, FILTER_ACTION_UPDATE, FilterValue, ActiveFilter } from '../../types/Filters';
import { HEALTHY, DEGRADED, FAILURE, NA } from 'src/types/Health';
import { removeDuplicatesArray } from 'src/utils/Common';

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
  filterType: 'select',
  action: FILTER_ACTION_UPDATE,
  filterValues: presenceValues
};

export const healthFilter: FilterType = {
  id: 'health',
  title: 'Health',
  placeholder: 'Filter by Health',
  filterType: 'select',
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
      id: 'na',
      title: NA.name
    }
  ]
};

export const getFilterSelectedValues = (filter: FilterType, activeFilters: ActiveFilter[]): string[] => {
  const selected: string[] = activeFilters
    .filter(activeFilter => activeFilter.category === filter.title)
    .map(activeFilter => activeFilter.value);
  return removeDuplicatesArray(selected);
};

export const getPresenceFilterValue = (filter: FilterType, activeFilters: ActiveFilter[]): boolean | undefined => {
  const presenceFilters = activeFilters.filter(activeFilter => activeFilter.category === filter.title);
  if (presenceFilters.length > 0) {
    return presenceFilters[0].value === 'Present';
  }
  return undefined;
};
