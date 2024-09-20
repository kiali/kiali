import { t } from 'utils/I18nUtils';
import {
  FILTER_ACTION_APPEND,
  FilterType,
  FILTER_ACTION_UPDATE,
  FilterValue,
  ActiveFiltersInfo,
  AllFilterTypes
} from '../../types/Filters';
import { HEALTHY, DEGRADED, FAILURE, NA, NOT_READY } from '../../types/Health';
import { removeDuplicatesArray } from '../../utils/Common';

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
      id: NA.name,
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

export const filterByHealth = (items: any[], filterValues: string[]): any[] => {
  return items.filter(itemWithHealth => filterValues.includes(itemWithHealth.health.getGlobalStatus().name));
};
