import history, { URLParam, HistoryManager } from '../../app/History';
import { config } from '../../config';
import {
  ActiveFilter,
  ActiveFiltersInfo,
  DEFAULT_LABEL_OPERATION,
  FilterType,
  ID_LABEL_OPERATION,
  LabelOperation
} from '../../types/Filters';
import { SortField } from '../../types/SortFilters';
import * as AlertUtils from '../../utils/AlertUtils';

export const perPageOptions: number[] = [5, 10, 15];
const defaultDuration = 600;
const defaultRefreshInterval = config.toolbar.defaultRefreshInterval;

export const handleError = (error: string) => {
  AlertUtils.add(error);
};

export const getFiltersFromURL = (filterTypes: FilterType[]): ActiveFiltersInfo => {
  const urlParams = new URLSearchParams(history.location.search);
  const activeFilters: ActiveFilter[] = [];
  filterTypes.forEach(filter => {
    urlParams.getAll(filter.id).forEach(value => {
      activeFilters.push({
        category: filter.title,
        value: value
      });
    });
  });

  return {
    filters: activeFilters,
    op: (urlParams.get(ID_LABEL_OPERATION) as LabelOperation) || DEFAULT_LABEL_OPERATION
  };
};

export const setFiltersToURL = (filterTypes: FilterType[], filters: ActiveFiltersInfo): ActiveFiltersInfo => {
  const urlParams = new URLSearchParams(history.location.search);
  filterTypes.forEach(type => {
    urlParams.delete(type.id);
  });
  urlParams.delete(ID_LABEL_OPERATION);
  const cleanFilters: ActiveFilter[] = [];

  filters.filters.forEach(activeFilter => {
    const filterType = filterTypes.find(filter => filter.title === activeFilter.category);
    if (!filterType) {
      return;
    }
    cleanFilters.push(activeFilter);
    urlParams.append(filterType.id, activeFilter.value);
  });
  urlParams.append(ID_LABEL_OPERATION, filters.op);
  // Resetting pagination when filters change
  history.push(history.location.pathname + '?' + urlParams.toString());
  return { filters: cleanFilters, op: filters.op || DEFAULT_LABEL_OPERATION };
};

export const filtersMatchURL = (filterTypes: FilterType[], filters: ActiveFiltersInfo): boolean => {
  // This can probably be improved and/or simplified?
  const fromFilters: Map<string, string[]> = new Map<string, string[]>();
  filters.filters.forEach(activeFilter => {
    const existingValue = fromFilters.get(activeFilter.category) || [];
    fromFilters.set(activeFilter.category, existingValue.concat(activeFilter.value));
  });

  const fromURL: Map<string, string[]> = new Map<string, string[]>();
  const urlParams = new URLSearchParams(history.location.search);
  filterTypes.forEach(filter => {
    const values = urlParams.getAll(filter.id);
    if (values.length > 0) {
      const existing = fromURL.get(filter.title) || [];
      fromURL.set(filter.title, existing.concat(values));
    }
  });

  if (fromFilters.size !== fromURL.size) {
    return false;
  }
  let equalFilters = true;
  fromFilters.forEach((filterValues, filterName) => {
    const aux = fromURL.get(filterName) || [];
    equalFilters =
      equalFilters && filterValues.every(value => aux.includes(value)) && filterValues.length === aux.length;
  });

  return equalFilters;
};

export const isCurrentSortAscending = (): boolean => {
  return (HistoryManager.getParam(URLParam.DIRECTION) || 'asc') === 'asc';
};

export const currentDuration = (): number => {
  return HistoryManager.getDuration() || defaultDuration;
};

export const currentRefreshInterval = (): number => {
  const refreshInterval = HistoryManager.getNumericParam(URLParam.REFRESH_INTERVAL);
  if (refreshInterval === undefined) {
    return defaultRefreshInterval;
  }
  return refreshInterval;
};

export const currentSortField = <T>(sortFields: SortField<T>[]): SortField<T> => {
  const queriedSortedField = HistoryManager.getParam(URLParam.SORT) || sortFields[0].param;
  return (
    sortFields.find(sortField => {
      return sortField.param === queriedSortedField;
    }) || sortFields[0]
  );
};
