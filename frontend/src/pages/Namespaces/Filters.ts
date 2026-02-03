import { t } from 'utils/I18nUtils';
import {
  ActiveFiltersInfo,
  FILTER_ACTION_APPEND,
  AllFilterTypes,
  RunnableFilter,
  FilterValue
} from '../../types/Filters';
import { DEGRADED, FAILURE, HEALTHY, NOT_READY } from '../../types/Health';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { MTLSStatuses } from '../../types/TLSStatus';
import { TextInputTypes } from '@patternfly/react-core';

export const nameFilter: RunnableFilter<NamespaceInfo> = {
  category: t('Namespace'),
  placeholder: t('Filter by Namespace'),
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: [],
  run: (namespace: NamespaceInfo, filters: ActiveFiltersInfo) =>
    filters.filters.some(f => namespace.name.includes(f.value))
};

const mtlsValues: FilterValue[] = [
  { id: 'enabled', title: t('Enabled') },
  { id: 'partiallyEnabled', title: t('Partially Enabled') },
  { id: 'disabled', title: t('Disabled') }
];

const statusMap = new Map<string, string>([
  [MTLSStatuses.ENABLED, t('Enabled')],
  [MTLSStatuses.PARTIALLY, t('Partially Enabled')],
  [MTLSStatuses.NOT_ENABLED, t('Disabled')],
  [MTLSStatuses.DISABLED, t('Disabled')]
]);

export const mtlsFilter: RunnableFilter<NamespaceInfo> = {
  category: t('mTLS'),
  placeholder: t('Filter by mTLS'),
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: mtlsValues,
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    return ns.tlsStatus ? filters.filters.some(f => statusMap.get(ns.tlsStatus!.status) === f.value) : false;
  }
};

export const labelFilter: RunnableFilter<NamespaceInfo> = {
  category: t('Namespace Label'),
  placeholder: t('Filter by Namespace Label'),
  filterType: AllFilterTypes.nsLabel,
  action: FILTER_ACTION_APPEND,
  filterValues: [],
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    return filters.filters.some(f => {
      if (f.value.includes('=')) {
        const [k, v] = f.value.split('=');
        return v.split(',').some(val => !!ns.labels && k in ns.labels && ns.labels[k].startsWith(val));
      } else {
        return !!ns.labels && Object.keys(ns.labels).some(label => label.startsWith(f.value));
      }
    });
  }
};

interface HealthFilters {
  noFilter: boolean;
  showInError: boolean;
  showInNotReady: boolean;
  showInSuccess: boolean;
  showInWarning: boolean;
}

const healthValues: FilterValue[] = [
  { id: NOT_READY.id, title: NOT_READY.name },
  { id: FAILURE.id, title: FAILURE.name },
  { id: DEGRADED.id, title: DEGRADED.name },
  { id: HEALTHY.id, title: HEALTHY.name }
];

export enum NamespaceCategory {
  DATA_PLANE = 'Data plane',
  CONTROL_PLANE = 'Control plane'
}

export const getCategoryText = (isControlPlane?: boolean): string => {
  return isControlPlane ? t(NamespaceCategory.CONTROL_PLANE) : t(NamespaceCategory.DATA_PLANE);
};

export const getCategoryValue = (isControlPlane?: boolean): string => {
  return isControlPlane ? NamespaceCategory.CONTROL_PLANE : NamespaceCategory.DATA_PLANE;
};

const summarizeHealthFilters = (healthFilters: ActiveFiltersInfo): HealthFilters => {
  if (healthFilters.filters.length === 0) {
    return {
      noFilter: true,
      showInNotReady: true,
      showInError: true,
      showInWarning: true,
      showInSuccess: true
    };
  }

  let showInNotReady = false,
    showInError = false,
    showInWarning = false,
    showInSuccess = false;

  healthFilters.filters.forEach(f => {
    switch (f.value) {
      case NOT_READY.id:
        showInNotReady = true;
        break;
      case FAILURE.id:
        showInError = true;
        break;
      case DEGRADED.id:
        showInWarning = true;
        break;
      case HEALTHY.id:
        showInSuccess = true;
        break;
      default:
    }
  });

  return {
    noFilter: false,
    showInNotReady: showInNotReady,
    showInError: showInError,
    showInWarning: showInWarning,
    showInSuccess: showInSuccess
  };
};

export const healthFilter: RunnableFilter<NamespaceInfo> = {
  category: t('Health'),
  placeholder: t('Filter by Health'),
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: healthValues,
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    const { showInNotReady, showInError, showInWarning, showInSuccess, noFilter } = summarizeHealthFilters(filters);

    if (noFilter) {
      return true;
    }

    // Namespaces page: check all three status types (statusApp, statusService, statusWorkload)
    if (ns.statusApp || ns.statusService || ns.statusWorkload) {
      // Collect all statuses from the three types
      const allStatuses = [ns.statusApp, ns.statusService, ns.statusWorkload].filter(s => s !== undefined);

      if (allStatuses.length === 0) {
        return false;
      }

      // Check if any status matches the filter criteria
      const hasNotReady = allStatuses.some(s => s && s.inNotReady.length > 0);
      const hasError = allStatuses.some(s => s && s.inError.length > 0);
      const hasWarning = allStatuses.some(s => s && s.inWarning.length > 0);
      const hasSuccess = allStatuses.some(s => s && s.inSuccess.length > 0);
      const hasOnlySuccess = hasSuccess && !hasError && !hasWarning;

      return (
        (showInNotReady && hasNotReady) ||
        (showInError && hasError) ||
        (showInWarning && hasWarning) ||
        (showInSuccess && hasOnlySuccess)
      );
    }

    return false;
  }
};

const categoryValues: FilterValue[] = [
  { id: NamespaceCategory.DATA_PLANE, title: t(NamespaceCategory.DATA_PLANE) },
  { id: NamespaceCategory.CONTROL_PLANE, title: t(NamespaceCategory.CONTROL_PLANE) }
];

export const categoryFilter: RunnableFilter<NamespaceInfo> = {
  category: t('Type'),
  placeholder: t('Filter by Type'),
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: categoryValues,
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    if (filters.filters.length === 0) {
      return true;
    }

    const categoryValue = getCategoryValue(ns.isControlPlane);
    return filters.filters.some(f => f.value === categoryValue);
  }
};

export const availableFilters: RunnableFilter<NamespaceInfo>[] = [
  nameFilter,
  healthFilter,
  categoryFilter,
  mtlsFilter,
  labelFilter
];
