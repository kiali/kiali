import { FILTER_ACTION_APPEND, FilterType, FilterValue } from '../../types/Filters';
import { FAILURE, DEGRADED, HEALTHY } from '../../types/Health';
import { NamespaceInfo } from './NamespaceInfo';

export namespace FiltersAndSorts {
  export const nameFilter: FilterType = {
    id: 'namespace_search',
    title: 'Name',
    placeholder: 'Filter by Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  const healthValues: FilterValue[] = [
    {
      id: FAILURE.name,
      title: FAILURE.name
    },
    {
      id: DEGRADED.name,
      title: DEGRADED.name
    },
    {
      id: HEALTHY.name,
      title: HEALTHY.name
    }
  ];

  export const healthFilter: FilterType = {
    id: 'health',
    title: 'Health',
    placeholder: 'Filter by Application Health',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: healthValues
  };

  export const availableFilters: FilterType[] = [nameFilter, healthFilter];

  export interface SortField {
    id: string;
    title: string;
    isNumeric: boolean;
    param: string;
    compare: (a: NamespaceInfo, b: NamespaceInfo) => number;
  }

  export const sortFields: SortField[] = [
    {
      id: 'namespace',
      title: 'Name',
      isNumeric: false,
      param: 'ns',
      compare: (a: NamespaceInfo, b: NamespaceInfo) => a.name.localeCompare(b.name)
    },
    {
      id: 'health',
      title: 'Status',
      isNumeric: false,
      param: 'h',
      compare: (a: NamespaceInfo, b: NamespaceInfo) => {
        let diff = a.appsInError.length - b.appsInError.length;
        if (diff !== 0) {
          return diff;
        }
        diff = a.appsInWarning.length - b.appsInWarning.length;
        if (diff !== 0) {
          return diff;
        }
        // default comparison fallback
        return a.name.localeCompare(b.name);
      }
    }
  ];
}
