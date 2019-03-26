import { ActiveFilter, FILTER_ACTION_APPEND, FilterTypeWithFilter, FilterValue } from '../../types/Filters';
import { DEGRADED, FAILURE, HEALTHY } from '../../types/Health';
import { NamespaceInfo } from './NamespaceInfo';
import { SortField } from '../../types/SortFilters';
import { MTLSStatuses } from '../../types/TLSStatus';

export namespace FiltersAndSorts {
  export const nameFilter: FilterTypeWithFilter<NamespaceInfo> = {
    id: 'namespace_search',
    title: 'Name',
    placeholder: 'Filter by Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: [],
    filter: (namespaces: NamespaceInfo[], filters: ActiveFilter[]) => {
      return namespaces.filter(ns => filters.some(f => ns.name.includes(f.value)));
    }
  };

  export const mtlsValues: FilterValue[] = [
    {
      id: 'enabled',
      title: 'Enabled'
    },
    {
      id: 'partiallyEnabled',
      title: 'Partially Enabled'
    },
    {
      id: 'notEnabled',
      title: 'Not Enabled'
    }
  ];

  const statusMap = new Map<string, string>([
    ['Enabled', MTLSStatuses.ENABLED],
    ['Partially Enabled', MTLSStatuses.PARTIALLY],
    ['Not Enabled', MTLSStatuses.NOT_ENABLED]
  ]);

  export const mtlsFilter: FilterTypeWithFilter<NamespaceInfo> = {
    id: 'mtls',
    title: 'mTLS status',
    placeholder: 'Filter by mTLS status',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: mtlsValues,
    filter: (namespaces: NamespaceInfo[], filters: ActiveFilter[]) => {
      return namespaces.filter(
        ns => ns.tlsStatus && filters.some(f => ns.tlsStatus!.status === statusMap.get(f.value))
      );
    }
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

  const summarizeHealthFilters = (healthFilters: ActiveFilter[]) => {
    if (healthFilters.length === 0) {
      return {
        noFilter: true,
        showInError: true,
        showInWarning: true,
        showInSuccess: true
      };
    }
    let showInError = false,
      showInWarning = false,
      showInSuccess = false;
    healthFilters.forEach(f => {
      switch (f.value) {
        case FAILURE.name:
          showInError = true;
          break;
        case DEGRADED.name:
          showInWarning = true;
          break;
        case HEALTHY.name:
          showInSuccess = true;
          break;
        default:
      }
    });
    return {
      noFilter: false,
      showInError: showInError,
      showInWarning: showInWarning,
      showInSuccess: showInSuccess
    };
  };

  export const healthFilter: FilterTypeWithFilter<NamespaceInfo> = {
    id: 'health',
    title: 'Health',
    placeholder: 'Filter by Application Health',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: healthValues,
    filter: (namespaces: NamespaceInfo[], filters: ActiveFilter[]) => {
      const { showInError, showInWarning, showInSuccess, noFilter } = summarizeHealthFilters(filters);
      return namespaces.filter(ns => {
        return (
          noFilter ||
          (ns.status &&
            ((showInError && ns.status.inError.length > 0) ||
              (showInWarning && ns.status.inWarning.length > 0) ||
              (showInSuccess && ns.status.inSuccess.length > 0)))
        );
      });
    }
  };

  export const availableFilters: FilterTypeWithFilter<NamespaceInfo>[] = [nameFilter, healthFilter, mtlsFilter];

  export const filterBy = (namespaces: NamespaceInfo[], filters: ActiveFilter[]) => {
    let filteredNamespaces: NamespaceInfo[] = namespaces;

    availableFilters.forEach(availableFilter => {
      const activeFilters = filters.filter(af => af.category === availableFilter.title);
      if (activeFilters.length) {
        filteredNamespaces = availableFilter.filter(filteredNamespaces, activeFilters);
      }
    });

    return filteredNamespaces;
  };

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
    },
    {
      id: 'mtls',
      title: 'mTLS',
      isNumeric: false,
      param: 'm',
      compare: (a: NamespaceInfo, b: NamespaceInfo) => {
        if (a.tlsStatus && b.tlsStatus) {
          return a.tlsStatus.status.localeCompare(b.tlsStatus.status);
        } else if (a.tlsStatus) {
          return -1;
        } else if (b.tlsStatus) {
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
