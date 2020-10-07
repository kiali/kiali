import { ActiveFiltersInfo, FILTER_ACTION_APPEND, FilterTypes, RunnableFilter, FilterValue } from '../../types/Filters';
import { DEGRADED, FAILURE, HEALTHY } from '../../types/Health';
import { NamespaceInfo } from './NamespaceInfo';
import { MTLSStatuses } from '../../types/TLSStatus';
import { TextInputTypes } from '@patternfly/react-core';

export const nameFilter: RunnableFilter<NamespaceInfo> = {
  id: 'namespace_search',
  title: 'Namespace',
  placeholder: 'Filter by Namespace',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: [],
  run: (namespace: NamespaceInfo, filters: ActiveFiltersInfo) =>
    filters.filters.some(f => namespace.name.includes(f.value))
};

export const mtlsValues: FilterValue[] = [
  { id: 'enabled', title: 'Enabled' },
  { id: 'partiallyEnabled', title: 'Partially Enabled' },
  { id: 'disabled', title: 'Disabled' }
];

const statusMap = new Map<string, string>([
  [MTLSStatuses.ENABLED, 'Enabled'],
  [MTLSStatuses.PARTIALLY, 'Partially Enabled'],
  [MTLSStatuses.NOT_ENABLED, 'Disabled'],
  [MTLSStatuses.DISABLED, 'Disabled']
]);

export const mtlsFilter: RunnableFilter<NamespaceInfo> = {
  id: 'mtls',
  title: 'mTLS status',
  placeholder: 'Filter by mTLS status',
  filterType: FilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: mtlsValues,
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    return ns.tlsStatus ? filters.filters.some(f => statusMap.get(ns.tlsStatus!.status) === f.value) : false;
  }
};

export const labelFilter: RunnableFilter<NamespaceInfo> = {
  id: 'nsLabel',
  title: 'Namespace Label',
  placeholder: 'Filter by Label',
  filterType: FilterTypes.nsLabel,
  action: FILTER_ACTION_APPEND,
  filterValues: [],
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    return filters.filters.some(f => {
      if (f.value.includes(':')) {
        const [k, v] = f.value.split(':');
        return v.split(',').some(val => !!ns.labels && k in ns.labels && ns.labels[k].startsWith(val));
      } else {
        return !!ns.labels && Object.keys(ns.labels).some(label => label.startsWith(f.value));
      }
    });
  }
};

const healthValues: FilterValue[] = [
  { id: FAILURE.name, title: FAILURE.name },
  { id: DEGRADED.name, title: DEGRADED.name },
  { id: HEALTHY.name, title: HEALTHY.name }
];

const summarizeHealthFilters = (healthFilters: ActiveFiltersInfo) => {
  if (healthFilters.filters.length === 0) {
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
  healthFilters.filters.forEach(f => {
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

export const healthFilter: RunnableFilter<NamespaceInfo> = {
  id: 'health',
  title: 'Health',
  placeholder: 'Filter by Application Health',
  filterType: FilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: healthValues,
  run: (ns: NamespaceInfo, filters: ActiveFiltersInfo) => {
    const { showInError, showInWarning, showInSuccess, noFilter } = summarizeHealthFilters(filters);
    return noFilter
      ? true
      : ns.status
      ? (showInError && ns.status.inError.length > 0) ||
        (showInWarning && ns.status.inWarning.length > 0) ||
        (showInSuccess && ns.status.inSuccess.length > 0)
      : false;
  }
};

export const availableFilters: RunnableFilter<NamespaceInfo>[] = [nameFilter, healthFilter, mtlsFilter, labelFilter];
