import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import * as MessageCenter from '../../utils/MessageCenter';
import { URLParameter } from '../../types/Parameters';
import { Pagination } from '../../types/Pagination';
import { FilterType, ActiveFilter } from '../../types/Filters';
import { FilterSelected } from '../Filters/StatefulFilters';
import { config } from '../../config';

export namespace ListPage {
  const ACTION_APPEND = 'append';
  const ACTION_SET = 'set';

  export const perPageOptions: number[] = [5, 10, 15];
  const defaultDuration = 600;
  const defaultPollInterval = config().toolbar.defaultPollInterval;

  export interface Hooks {
    handleError: (error: string) => void;
    onParamChange: (params: URLParameter[], paramAction?: string, historyAction?: string) => void;
    onParamDelete: (params: string[]) => void;
    getQueryParam: (queryName: string) => string[] | undefined;
    getSingleQueryParam: (queryName: string) => string | undefined;
    getSingleIntQueryParam: (queryName: string) => number | undefined;
    setSelectedFiltersFromURL: (filterTypes: FilterType[]) => void;
    setSelectedFiltersToURL: (filterTypes: FilterType[]) => void;
    filtersMatchURL: (filterTypes: FilterType[]) => boolean;
    isCurrentSortAscending: () => boolean;
    currentDuration: () => number;
    currentPollInterval: () => number;
  }

  export class Component<P, S> extends React.Component<RouteComponentProps<P>, S> implements Hooks {
    handleError = (error: string) => {
      MessageCenter.add(error);
    };

    onParamChange = (params: URLParameter[], paramAction?: string, historyAction?: string) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      if (params.length > 0 && paramAction === ACTION_APPEND) {
        params.forEach(param => {
          urlParams.delete(param.name);
        });
      }

      params.forEach((param: URLParameter) => {
        if (param.value === '') {
          urlParams.delete(param.name);
        } else {
          if (paramAction === ACTION_APPEND) {
            urlParams.append(param.name, param.value);
          } else if (!paramAction || paramAction === ACTION_SET) {
            urlParams.set(param.name, param.value);
          }
        }
      });

      if (historyAction === 'replace') {
        this.props.history.replace(this.props.location.pathname + '?' + urlParams.toString());
      } else {
        this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
      }
    };

    onParamDelete = (params: string[]) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      params.forEach(param => {
        urlParams.delete(param);
      });

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };

    getQueryParam = (queryName: string): string[] | undefined => {
      const urlParams = new URLSearchParams(this.props.location.search);
      const values = urlParams.getAll(queryName);

      if (values.length === 0) {
        return undefined;
      }

      return values;
    };

    getSingleQueryParam = (queryName: string): string | undefined => {
      const p = this.getQueryParam(queryName);
      return p === undefined ? undefined : p[0];
    };

    getSingleIntQueryParam = (queryName: string): number | undefined => {
      const p = this.getQueryParam(queryName);
      return p === undefined ? undefined : parseInt(p[0], 10);
    };

    setSelectedFiltersFromURL(filterTypes: FilterType[]) {
      const urlParams = new URLSearchParams(this.props.location.search);
      const activeFilters: ActiveFilter[] = [];
      filterTypes.forEach(filter => {
        urlParams.getAll(filter.id).forEach(value => {
          activeFilters.push({
            label: filter.title + ': ' + value,
            category: filter.title,
            value: value
          });
        });
      });
      FilterSelected.setSelected(activeFilters);
    }

    setSelectedFiltersToURL(filterTypes: FilterType[]) {
      const filters = FilterSelected.getSelected();
      const urlParams = new URLSearchParams(this.props.location.search);
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
      urlParams.delete('page');
      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
      // Update the selected filters list, as some may have been removed
      FilterSelected.setSelected(cleanFilters);
    }

    filtersMatchURL(filterTypes: FilterType[]): boolean {
      const filters = FilterSelected.getSelected();
      // This can probably be improved and/or simplified?
      const fromFilters: Map<string, string[]> = new Map<string, string[]>();
      filters.map(activeFilter => {
        const existingValue = fromFilters.get(activeFilter.category) || [];
        fromFilters.set(activeFilter.category, existingValue.concat(activeFilter.value));
      });

      const fromURL: Map<string, string[]> = new Map<string, string[]>();
      const urlParams = new URLSearchParams(this.props.location.search);
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
    }

    currentPagination(): Pagination {
      return {
        page: this.getSingleIntQueryParam('page') || 1,
        perPage: this.getSingleIntQueryParam('perPage') || perPageOptions[1],
        perPageOptions: perPageOptions
      };
    }

    isCurrentSortAscending(): boolean {
      return (this.getSingleQueryParam('direction') || 'asc') === 'asc';
    }

    currentDuration() {
      return this.getSingleIntQueryParam('duration') || defaultDuration;
    }

    currentPollInterval() {
      const pi = this.getSingleIntQueryParam('pi');
      if (pi === undefined) {
        return defaultPollInterval;
      }
      return pi;
    }
  }
}
