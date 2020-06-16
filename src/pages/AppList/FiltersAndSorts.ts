import { ActiveFiltersInfo, FILTER_ACTION_APPEND, FilterType } from '../../types/Filters';
import { AppListItem } from '../../types/AppList';
import { SortField } from '../../types/SortFilters';
import { getRequestErrorsStatus, WithAppHealth, hasHealth } from '../../types/Health';
import {
  istioSidecarFilter,
  healthFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth,
  labelFilter
} from '../../components/Filters/CommonFilters';
import { hasMissingSidecar } from '../../components/VirtualList/Config';
import { TextInputTypes } from '@patternfly/react-core';
import { filterByLabel } from '../../helpers/LabelFilterHelper';

export const sortFields: SortField<AppListItem>[] = [
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
    id: 'details',
    title: 'Details',
    isNumeric: false,
    param: 'is',
    compare: (a, b) => {
      // First sort by missing sidecar
      const aSC = hasMissingSidecar(a) ? 1 : 0;
      const bSC = hasMissingSidecar(b) ? 1 : 0;
      if (aSC !== bSC) {
        return aSC - bSC;
      }
      // Finally by name
      return a.name.localeCompare(b.name);
    }
  },
  {
    id: 'health',
    title: 'Health',
    isNumeric: false,
    param: 'he',
    compare: (a, b) => {
      if (hasHealth(a) && hasHealth(b)) {
        const statusForA = a.health.getGlobalStatus();
        const statusForB = b.health.getGlobalStatus();

        if (statusForA.priority === statusForB.priority) {
          // If both apps have same health status, use error rate to determine order.
          const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
          const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
          return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioB - ratioA;
        }

        return statusForB.priority - statusForA.priority;
      } else {
        return 0;
      }
    }
  }
];

const appNameFilter: FilterType = {
  id: 'appname',
  title: 'App Name',
  placeholder: 'Filter by App Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const availableFilters: FilterType[] = [appNameFilter, istioSidecarFilter, healthFilter, labelFilter];

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
  filters: ActiveFiltersInfo
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

  const appLabelsSelected = getFilterSelectedValues(labelFilter, filters);
  if (appLabelsSelected.length > 0) {
    ret = filterByLabel(ret, appLabelsSelected, filters.op) as AppListItem[];
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
