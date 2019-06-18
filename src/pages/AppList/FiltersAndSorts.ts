import { ActiveFilter, FILTER_ACTION_APPEND, FilterType } from '../../types/Filters';
import { AppListItem } from '../../types/AppList';
import { GenericSortField, HealthSortField } from '../../types/SortFilters';
import { getRequestErrorsStatus, WithAppHealth } from '../../types/Health';
import {
  istioSidecarFilter,
  healthFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth
} from '../../components/Filters/CommonFilters';

export const sortFields: GenericSortField<AppListItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a, b) => {
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
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    id: 'istiosidecar',
    title: 'IstioSidecar',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => {
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
    id: 'health',
    title: 'Health',
    isNumeric: false,
    param: 'he',
    compare: (a: WithAppHealth<AppListItem>, b: WithAppHealth<AppListItem>) => {
      const statusForA = a.health.getGlobalStatus();
      const statusForB = b.health.getGlobalStatus();

      if (statusForA.priority === statusForB.priority) {
        // If both apps have same health status, use error rate to determine order.
        const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
        const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
        return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioB - ratioA;
      }

      return statusForB.priority - statusForA.priority;
    }
  } as HealthSortField<AppListItem>
];

const appNameFilter: FilterType = {
  id: 'appname',
  title: 'App Name',
  placeholder: 'Filter by App Name',
  filterType: 'text',
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const availableFilters: FilterType[] = [appNameFilter, istioSidecarFilter, healthFilter];

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

export const filterBy = (appsList: AppListItem[], filters: ActiveFilter[]): Promise<AppListItem[]> | AppListItem[] => {
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
  sortField: GenericSortField<AppListItem>,
  isAscending: boolean
): Promise<AppListItem[]> => {
  if (sortField.title === 'Health') {
    // In the case of health sorting, we may not have all health promises ready yet
    // So we need to get them all before actually sorting
    const allHealthPromises: Promise<WithAppHealth<AppListItem>>[] = unsorted.map(item => {
      return item.healthPromise.then((health): WithAppHealth<AppListItem> => ({ ...item, health }));
    });
    return Promise.all(allHealthPromises).then(arr => {
      return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    });
  }
  const sorted = unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};
