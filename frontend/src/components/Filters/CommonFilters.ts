import { t } from 'utils/I18nUtils';
import {
  FILTER_ACTION_APPEND,
  FilterType,
  FILTER_ACTION_UPDATE,
  FilterValue,
  ActiveFiltersInfo,
  AllFilterTypes
} from '../../types/Filters';
import { HEALTHY, DEGRADED, FAILURE, NA, NOT_READY, Status } from '../../types/Health';
import { removeDuplicatesArray } from '../../utils/Common';

const allStatuses: Status[] = [HEALTHY, DEGRADED, FAILURE, NOT_READY, NA];

export const presenceValues: FilterValue[] = [
  {
    id: 'Present',
    title: t('Present')
  },
  {
    id: 'Not Present',
    title: t('Not Present')
  }
];

export const istioSidecarFilter: FilterType = {
  category: 'Istio Sidecar',
  placeholder: 'Filter by Istio Sidecar Validation',
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_UPDATE,
  filterValues: presenceValues
};

export const healthFilter: FilterType = {
  category: 'Health',
  placeholder: 'Filter by Health',
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: HEALTHY.id,
      title: HEALTHY.name
    },
    {
      id: DEGRADED.id,
      title: DEGRADED.name
    },
    {
      id: FAILURE.id,
      title: FAILURE.name
    },
    {
      id: NOT_READY.id,
      title: NOT_READY.name
    },
    {
      id: NA.id,
      title: NA.name
    }
  ]
};

export const labelFilter: FilterType = {
  category: 'Label',
  placeholder: 'Filter by Label',
  filterType: AllFilterTypes.label,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const getFilterSelectedValues = (filter: FilterType, activeFilters: ActiveFiltersInfo): string[] => {
  const selected: string[] = activeFilters.filters
    .filter(activeFilter => activeFilter.category === filter.category)
    .map(activeFilter => activeFilter.value);
  return removeDuplicatesArray(selected);
};

export const getPresenceFilterValue = (filter: FilterType, activeFilters: ActiveFiltersInfo): boolean | undefined => {
  const presenceFilters = activeFilters.filters.filter(activeFilter => activeFilter.category === filter.category);

  if (presenceFilters.length > 0) {
    return presenceFilters[0].value === 'Present';
  }
  return undefined;
};

// filterByHealth filters items by their backend-provided health status.
// Matches against both Status.id and Status.name to handle values stored as
// translated titles (from dropdown selection) or raw IDs (from URL params).
export const filterByHealth = (items: any[], filterValues: string[]): any[] => {
  const matchingIds = new Set(
    allStatuses.filter(s => filterValues.includes(s.id) || filterValues.includes(s.name)).map(s => s.id)
  );
  return items.filter(itemWithHealth => matchingIds.has(itemWithHealth.health.getStatus().id));
};
