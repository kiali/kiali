import { FILTER_ACTION_APPEND, FilterType, FilterValue } from '../../types/Filters';
import { FAILURE, DEGRADED, HEALTHY } from '../../types/Health';
import { NamespaceInfo } from './NamespaceInfo';
import { SortField } from '../../types/SortFilters';

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

  export const sortFields: SortField<NamespaceInfo>[] = [
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
        if (a.status && b.status) {
          let diff = b.status.inError.length - a.status.inError.length;
          if (diff !== 0) {
            return diff;
          }
          diff = b.status.inWarning.length - a.status.inWarning.length;
          if (diff !== 0) {
            return diff;
          }
        } else if (a.status) {
          return -1;
        } else if (b.status) {
          return 1;
        }
        // default comparison fallback
        return a.name.localeCompare(b.name);
      }
    }
  ];

  export const sortFunc = (
    allNamespaces: NamespaceInfo[],
    sortField: SortField<NamespaceInfo>,
    isAscending: boolean
  ) => {
    return allNamespaces.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  };
}
