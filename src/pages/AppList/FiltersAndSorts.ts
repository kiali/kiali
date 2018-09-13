import { ActiveFilter, FILTER_ACTION_APPEND, FILTER_ACTION_UPDATE, FilterType, FilterValue } from '../../types/Filters';
import { AppListItem } from '../../types/AppList';
import { removeDuplicatesArray } from '../../utils/Common';
import { getRequestErrorsRatio, AppHealth } from '../../types/Health';

type AppListItemHealth = AppListItem & { health: AppHealth };

export namespace AppListFilters {
  export interface SortField {
    id: string;
    title: string;
    isNumeric: boolean;
    param: string;
    compare: (a: AppListItem, b: AppListItem) => number;
  }

  export const sortFields: SortField[] = [
    {
      id: 'namespace',
      title: 'Namespace',
      isNumeric: false,
      param: 'ns',
      compare: (a: AppListItem, b: AppListItem) => {
        let sortValue = a.namespace.localeCompare(b.namespace);
        if (sortValue === 0) {
          sortValue = a.name.localeCompare(b.name);
        }
        return sortValue;
      }
    },
    {
      id: 'appname',
      title: 'App Name',
      isNumeric: false,
      param: 'wn',
      compare: (a: AppListItem, b: AppListItem) => a.name.localeCompare(b.name)
    },
    {
      id: 'istiosidecar',
      title: 'IstioSidecar',
      isNumeric: false,
      param: 'is',
      compare: (a: AppListItem, b: AppListItem) => {
        if (a.istioSidecar && !b.istioSidecar) {
          return -1;
        } else if (!a.istioSidecar && b.istioSidecar) {
          return 1;
        } else {
          return a.name.localeCompare(b.name);
        }
      }
    },
    {
      id: 'errorrate',
      title: 'Error Rate',
      isNumeric: true,
      param: 'er',
      compare: (a: AppListItemHealth, b: AppListItemHealth) => {
        if (a.health && b.health) {
          const ratioA = getRequestErrorsRatio(a.health.requests).value;
          const ratioB = getRequestErrorsRatio(b.health.requests).value;
          return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
        }
        return 0;
      }
    }
  ];

  const presenceValues: FilterValue[] = [
    {
      id: 'present',
      title: 'Present'
    },
    {
      id: 'notpresent',
      title: 'Not Present'
    }
  ];

  export const appNameFilter: FilterType = {
    id: 'appname',
    title: 'App Name',
    placeholder: 'Filter by App Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  export const istioSidecarFilter: FilterType = {
    id: 'istiosidecar',
    title: 'Istio Sidecar',
    placeholder: 'Filter by IstioSidecar Validation',
    filterType: 'select',
    action: FILTER_ACTION_UPDATE,
    filterValues: presenceValues
  };

  /** Filter Method */

  const filterByName = (items: AppListItem[], names: string[]): AppListItem[] => {
    let result = items;
    result = result.filter(item => {
      let appNameFiltered = true;
      if (names.length > 0) {
        appNameFiltered = false;
        for (let i = 0; i < names.length; i++) {
          if (item.name.includes(names[i])) {
            appNameFiltered = true;
            break;
          }
        }
      }
      return appNameFiltered;
    });
    return result;
  };

  const filterByIstioSidecar = (items: AppListItem[], istioSidecar: boolean): AppListItem[] => {
    return items.filter(item => item.istioSidecar === istioSidecar);
  };

  export const filterBy = (items: AppListItem[], filters: ActiveFilter[]) => {
    let results = items;
    /** Get AppName filter */
    let appNamesSelected: string[] = filters
      .filter(activeFilter => activeFilter.category === 'App Name')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    appNamesSelected = removeDuplicatesArray(appNamesSelected);

    /** Get IstioSidecar filter */
    let istioSidecarValidationFilters: ActiveFilter[] = filters.filter(
      activeFilter => activeFilter.category === 'Istio Sidecar'
    );
    let istioSidecar: boolean | undefined = undefined;

    if (istioSidecarValidationFilters.length > 0) {
      istioSidecar = istioSidecarValidationFilters[0].value === 'Present';
      results = filterByIstioSidecar(results, istioSidecar);
    }

    if (appNamesSelected.length > 0) {
      results = filterByName(results, appNamesSelected);
    }
    return results;
  };

  /** Sort Method */

  export const sortAppsItems = (
    unsorted: AppListItem[],
    sortField: AppListFilters.SortField,
    isAscending: boolean
  ): Promise<AppListItem[]> => {
    if (sortField.title === 'Error Rate') {
      // In the case of error rate sorting, we may not have all health promises ready yet
      // So we need to get them all before actually sorting
      const allHealthPromises: Promise<AppListItemHealth>[] = unsorted.map(item => {
        return item.healthPromise.then(health => {
          const withHealth: any = item;
          withHealth.health = health;
          return withHealth;
        });
      });
      return Promise.all(allHealthPromises).then(arr => {
        return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
      });
    }
    const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    return Promise.resolve(sorted);
  };
}
