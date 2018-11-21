import { ActiveFilter, FILTER_ACTION_APPEND, FilterType } from '../../types/Filters';
import { AppListItem } from '../../types/AppList';
import { SortField } from '../../types/SortFilters';
import { AppHealth, getRequestErrorsStatus } from '../../types/Health';
import NamespaceFilter from '../../components/Filters/NamespaceFilter';
import {
  istioSidecarFilter,
  healthFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth
} from '../../components/Filters/CommonFilters';

type AppListItemHealth = AppListItem & { health: AppHealth };

export namespace AppListFilters {
  export const sortFields: SortField<AppListItem>[] = [
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
          const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
          const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
          return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
        }
        return 0;
      }
    }
  ];

  const appNameFilter: FilterType = {
    id: 'appname',
    title: 'App Name',
    placeholder: 'Filter by App Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  export const availableFilters: FilterType[] = [
    NamespaceFilter.create(),
    appNameFilter,
    istioSidecarFilter,
    healthFilter
  ];
  export const namespaceFilter = availableFilters[0];

  /** Filter Method */

  const filterByName = (items: AppListItem[], names: string[]): AppListItem[] => {
    return items.filter(item => {
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
  };

  const filterByIstioSidecar = (items: AppListItem[], istioSidecar: boolean): AppListItem[] => {
    return items.filter(item => item.istioSidecar === istioSidecar);
  };

  export const filterBy = (
    appsList: AppListItem[],
    filters: ActiveFilter[]
  ): Promise<AppListItem[]> | AppListItem[] => {
    let ret = appsList;
    const istioSidecar = getPresenceFilterValue(istioSidecarFilter, filters);
    if (istioSidecar !== undefined) {
      ret = filterByIstioSidecar(ret, istioSidecar);
    }

    const appNamesSelected = getFilterSelectedValues(appNameFilter, filters);
    if (appNamesSelected.length > 0) {
      ret = filterByName(ret, appNamesSelected);
    }

    // We may have to perform a second round of filtering, using data fetched asynchronously (health)
    // If not, exit fast
    const healthSelected = getFilterSelectedValues(healthFilter, filters);
    if (healthSelected.length > 0) {
      return filterByHealth(ret, healthSelected);
    }
    return ret;
  };

  /** Sort Method */

  export const sortAppsItems = (
    unsorted: AppListItem[],
    sortField: SortField<AppListItem>,
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
