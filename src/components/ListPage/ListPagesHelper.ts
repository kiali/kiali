import history, { URLParams } from '../../app/History';
import { config } from '../../config';
import { ActiveFilter, FilterType } from '../../types/Filters';
import { Pagination } from '../../types/Pagination';
import { SortField } from '../../types/SortFilters';
import * as MessageCenter from '../../utils/MessageCenter';

export namespace ListPagesHelper {
  export const perPageOptions: number[] = [5, 10, 15];
  const defaultDuration = 600;
  const defaultPollInterval = config().toolbar.defaultPollInterval;

  export const handleError = (error: string) => {
    MessageCenter.add(error);
  };

  export const getQueryParam = (queryName: string): string[] | undefined => {
    const urlParams = new URLSearchParams(history.location.search);
    const values = urlParams.getAll(queryName);

    if (values.length === 0) {
      return undefined;
    }

    return values;
  };

  export const getSingleQueryParam = (queryName: string): string | undefined => {
    const p = getQueryParam(queryName);
    return p === undefined ? undefined : p[0];
  };

  export const getSingleIntQueryParam = (queryName: string): number | undefined => {
    const p = getQueryParam(queryName);
    return p === undefined ? undefined : Number(p[0]);
  };

  export const getFiltersFromURL = (filterTypes: FilterType[]): ActiveFilter[] => {
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
    return activeFilters;
  };

  export const setFiltersToURL = (filterTypes: FilterType[], filters: ActiveFilter[]): ActiveFilter[] => {
    const urlParams = new URLSearchParams(history.location.search);
    filterTypes.forEach(type => {
      urlParams.delete(type.id);
    });
    const cleanFilters: ActiveFilter[] = [];
    filters.forEach(activeFilter => {
      const filterType = filterTypes.find(filter => filter.title === activeFilter.category);
      if (!filterType) {
        return;
      }
      cleanFilters.push(activeFilter);
      urlParams.append(filterType.id, activeFilter.value);
    });
    // Resetting pagination when filters change
    urlParams.delete(URLParams.PAGE);
    history.push(history.location.pathname + '?' + urlParams.toString());
    return cleanFilters;
  };

  export const filtersMatchURL = (filterTypes: FilterType[], filters: ActiveFilter[]): boolean => {
    // This can probably be improved and/or simplified?
    const fromFilters: Map<string, string[]> = new Map<string, string[]>();
    filters.map(activeFilter => {
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

  export const currentPagination = (): Pagination => {
    return {
      page: getSingleIntQueryParam(URLParams.PAGE) || 1,
      perPage: getSingleIntQueryParam(URLParams.PER_PAGE) || perPageOptions[1],
      perPageOptions: perPageOptions
    };
  };

  export const isCurrentSortAscending = (): boolean => {
    return (getSingleQueryParam(URLParams.DIRECTION) || 'asc') === 'asc';
  };

  export const currentSortFieldId = (): string | undefined => {
    return getSingleQueryParam(URLParams.SORT);
  };

  export const currentDuration = (): number => {
    return getSingleIntQueryParam(URLParams.DURATION) || defaultDuration;
  };

  export const currentPollInterval = (): number => {
    const pi = getSingleIntQueryParam(URLParams.POLL_INTERVAL);
    if (pi === undefined) {
      return defaultPollInterval;
    }
    return pi;
  };

  export const currentSortField = <T>(sortFields: SortField<T>[]): SortField<T> => {
    const queriedSortedField = getQueryParam(URLParams.SORT) || [sortFields[0].param];
    return (
      sortFields.find(sortField => {
        return sortField.param === queriedSortedField[0];
      }) || sortFields[0]
    );
  };
}
