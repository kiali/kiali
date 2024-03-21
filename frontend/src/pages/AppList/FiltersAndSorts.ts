import { ActiveFiltersInfo, FILTER_ACTION_APPEND, FilterType, ToggleType } from '../../types/Filters';
import { calculateErrorRate } from '../../types/ErrorRate';
import { AppListItem } from '../../types/AppList';
import { SortField } from '../../types/SortFilters';
import { hasHealth } from '../../types/Health';
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
import { istioConfigTypeFilter } from '../IstioConfigList/FiltersAndSorts';
import { ObjectReference } from '../../types/IstioObjects';
import { serverConfig } from 'config';

export const sortFields: SortField<AppListItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a: AppListItem, b: AppListItem): number => {
      let sortValue = a.namespace.name.localeCompare(b.namespace.name);
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
    compare: (a: AppListItem, b: AppListItem): number => a.name.localeCompare(b.name)
  },
  {
    id: 'details',
    title: 'Details',
    isNumeric: false,
    param: 'is',
    compare: (a: AppListItem, b: AppListItem): number => {
      // First sort by missing sidecar
      const aSC = hasMissingSidecar(a) ? 1 : 0;
      const bSC = hasMissingSidecar(b) ? 1 : 0;
      if (aSC !== bSC) {
        return aSC - bSC;
      }

      // Second by Details
      const iRefA = a.istioReferences;
      const iRefB = b.istioReferences;
      const cmpRefs = compareObjectReferences(iRefA, iRefB);
      if (cmpRefs !== 0) {
        return cmpRefs;
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
    compare: (a: AppListItem, b: AppListItem): number => {
      if (hasHealth(a) && hasHealth(b)) {
        const statusForA = a.health.getGlobalStatus();
        const statusForB = b.health.getGlobalStatus();

        if (statusForA.priority === statusForB.priority) {
          // If both apps have same health status, use error rate to determine order.
          const ratioA = calculateErrorRate(a.namespace.name, a.name, 'app', a.health.requests).errorRatio.global.status
            .value;
          const ratioB = calculateErrorRate(b.namespace.name, b.name, 'app', b.health.requests).errorRatio.global.status
            .value;
          return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioB - ratioA;
        }

        return statusForB.priority - statusForA.priority;
      } else {
        return 0;
      }
    }
  },
  {
    id: 'cluster',
    title: 'Cluster',
    isNumeric: false,
    param: 'cl',
    compare: (a: AppListItem, b: AppListItem): number => {
      if (a.cluster && b.cluster) {
        let sortValue = a.cluster.localeCompare(b.cluster);
        if (sortValue === 0) {
          sortValue = a.name.localeCompare(b.name);
        }
        return sortValue;
      } else {
        return 0;
      }
    }
  }
];

const appNameFilter: FilterType = {
  category: 'App Name',
  placeholder: 'Filter by App Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const availableFilters: FilterType[] = [
  appNameFilter,
  istioConfigTypeFilter,
  istioSidecarFilter,
  healthFilter,
  labelFilter
];

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

const filterByIstioType = (items: AppListItem[], istioTypes: string[]): AppListItem[] => {
  return items.filter(item => item.istioReferences.filter(ref => istioTypes.includes(ref.objectType)).length !== 0);
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

  const istioTypeSelected = getFilterSelectedValues(istioConfigTypeFilter, filters);
  if (istioTypeSelected.length > 0) {
    return filterByIstioType(ret, istioTypeSelected);
  }
  return ret;
};

/** Column Toggle Method */

const healthToggle: ToggleType = {
  label: 'Health',
  name: 'health',
  isChecked: true
};

const istioResourcesToggle: ToggleType = {
  label: 'Istio Resources Detail',
  name: 'istioResources',
  isChecked: true
};

export const getAvailableToggles = (): ToggleType[] => {
  healthToggle.isChecked = serverConfig.kialiFeatureFlags.uiDefaults.list.includeHealth;
  istioResourcesToggle.isChecked = serverConfig.kialiFeatureFlags.uiDefaults.list.includeIstioResources;
  return [healthToggle, istioResourcesToggle];
};

/** Sort Method */

export const sortAppsItems = (
  unsorted: AppListItem[],
  sortField: SortField<AppListItem>,
  isAscending: boolean
): AppListItem[] => {
  return unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};

export const compareObjectReference = (a: ObjectReference, b: ObjectReference): number => {
  const cmpObjectType = a.objectType.localeCompare(b.objectType);
  if (cmpObjectType !== 0) {
    return cmpObjectType;
  }
  const cmpName = a.name.localeCompare(b.name);
  if (cmpName !== 0) {
    return cmpName;
  }

  return a.namespace.localeCompare(b.namespace);
};

// It assumes that is sorted
export const compareObjectReferences = (a: ObjectReference[], b: ObjectReference[]): number => {
  if (a.length === 0 && b.length === 0) {
    return 0;
  }
  if (a.length === 0 && b.length > 0) {
    return -1;
  }
  if (a.length > 0 && b.length === 0) {
    return 1;
  }
  if (a.length !== b.length) {
    return a.length - b.length;
  }
  for (let i = 0; i < a.length; i++) {
    const cmp = compareObjectReference(a[i], b[i]);
    if (cmp !== 0) {
      return cmp;
    }
  }
  return 0;
};

// Remove duplicates and sort references
export const sortIstioReferences = (unsorted: ObjectReference[], isAscending: boolean): ObjectReference[] => {
  const unique = unsorted.filter((item, index) => unsorted.indexOf(item) === index);
  return unique.sort((a, b) => {
    return isAscending ? compareObjectReference(a, b) : compareObjectReference(b, a);
  });
};
