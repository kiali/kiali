import { ActiveFiltersInfo, FilterType, FILTER_ACTION_APPEND, AllFilterTypes, ToggleType } from '../../types/Filters';
import { hasHealth } from '../../types/Health';
import { ServiceListItem } from '../../types/ServiceList';
import { SortField } from '../../types/SortFilters';
import {
  istioSidecarFilter,
  healthFilter,
  labelFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth
} from '../../components/Filters/CommonFilters';
import { hasMissingSidecar } from '../../components/VirtualList/Config';
import { TextInputTypes } from '@patternfly/react-core';
import { filterByLabel } from '../../helpers/LabelFilterHelper';
import { calculateErrorRate } from '../../types/ErrorRate';
import { istioConfigTypeFilter } from '../IstioConfigList/FiltersAndSorts';
import { compareObjectReferences } from '../AppList/FiltersAndSorts';
import { serverConfig } from 'config';
import { gvkToString } from '../../utils/IstioConfigUtils';

export const sortFields: SortField<ServiceListItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a: ServiceListItem, b: ServiceListItem): number => {
      let sortValue = a.namespace.localeCompare(b.namespace);
      if (sortValue === 0) {
        sortValue = a.name.localeCompare(b.name);
      }
      return sortValue;
    }
  },
  {
    id: 'servicename',
    title: 'Service Name',
    isNumeric: false,
    param: 'sn',
    compare: (a: ServiceListItem, b: ServiceListItem) => a.name.localeCompare(b.name)
  },
  {
    id: 'details',
    title: 'Details',
    isNumeric: false,
    param: 'is',
    compare: (a: ServiceListItem, b: ServiceListItem): number => {
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

      // Then by additional details
      const iconA = a.additionalDetailSample && a.additionalDetailSample.icon;
      const iconB = b.additionalDetailSample && b.additionalDetailSample.icon;
      if (iconA || iconB) {
        if (iconA && iconB) {
          const cmp = iconA.localeCompare(iconB);
          if (cmp !== 0) {
            return cmp;
          }
        } else {
          // Make asc => icon absence is last
          return iconA ? -1 : 1;
        }
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
    compare: (a: ServiceListItem, b: ServiceListItem): number => {
      if (hasHealth(a) && hasHealth(b)) {
        const statusForA = a.health.getGlobalStatus();
        const statusForB = b.health.getGlobalStatus();

        if (statusForA.priority === statusForB.priority) {
          // If both services have same health status, use error rate to determine order.
          const ratioA = calculateErrorRate(a.namespace, a.name, 'service', a.health.requests).errorRatio.global.status
            .value;
          const ratioB = calculateErrorRate(b.namespace, b.name, 'service', b.health.requests).errorRatio.global.status
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
    id: 'configvalidation',
    title: 'Config',
    isNumeric: false,
    param: 'cv',
    compare: (a: ServiceListItem, b: ServiceListItem): number => {
      let sortValue = -1;
      if (a.validation && !b.validation) {
        sortValue = -1;
      } else if (!a.validation && b.validation) {
        sortValue = 1;
      } else if (!a.validation && !b.validation) {
        sortValue = 0;
      } else if (a.validation && b.validation) {
        if (a.validation.valid && !b.validation.valid) {
          sortValue = -1;
        } else if (!a.validation.valid && b.validation.valid) {
          sortValue = 1;
        } else if (a.validation.valid && b.validation.valid) {
          sortValue = a.validation.checks.length - b.validation.checks.length;
        } else if (!a.validation.valid && !b.validation.valid) {
          sortValue = b.validation.checks.length - a.validation.checks.length;
        }
      }

      return sortValue || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'cluster',
    title: 'Cluster',
    isNumeric: false,
    param: 'cl',
    compare: (a: ServiceListItem, b: ServiceListItem): number => {
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

const serviceNameFilter: FilterType = {
  category: 'Service Name',
  placeholder: 'Filter by Service Name',
  filterType: TextInputTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

const serviceTypeFilter: FilterType = {
  category: 'Service Type',
  placeholder: 'Filter by Service Type',
  filterType: AllFilterTypes.typeAhead,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'Kubernetes',
      title: 'Kubernetes'
    },
    {
      id: 'External',
      title: 'External'
    },
    {
      id: 'Federation',
      title: 'Federation'
    }
  ]
};

export const availableFilters: FilterType[] = [
  serviceNameFilter,
  serviceTypeFilter,
  istioConfigTypeFilter,
  istioSidecarFilter,
  healthFilter,
  labelFilter
];

const filterByIstioSidecar = (items: ServiceListItem[], istioSidecar: boolean): ServiceListItem[] => {
  return items.filter(item => item.istioSidecar === istioSidecar);
};

const filterByName = (items: ServiceListItem[], names: string[]): ServiceListItem[] => {
  return items.filter(item => {
    let serviceNameFiltered = true;
    if (names.length > 0) {
      serviceNameFiltered = false;
      for (let i = 0; i < names.length; i++) {
        if (item.name.includes(names[i])) {
          serviceNameFiltered = true;
          break;
        }
      }
    }
    return serviceNameFiltered;
  });
};

const filterByServiceType = (items: ServiceListItem[], serviceTypes: string[]): ServiceListItem[] => {
  return items.filter(item => {
    let serviceTypeFiltered = true;
    if (serviceTypes.length > 0) {
      serviceTypeFiltered = false;
      for (let i = 0; i < serviceTypes.length; i++) {
        if (item.serviceRegistry.includes(serviceTypes[i])) {
          serviceTypeFiltered = true;
          break;
        }
      }
    }
    return serviceTypeFiltered;
  });
};

const filterByIstioType = (items: ServiceListItem[], istioTypes: string[]): ServiceListItem[] => {
  return items.filter(
    item => item.istioReferences.filter(ref => istioTypes.includes(gvkToString(ref.objectGVK))).length !== 0
  );
};

export const filterBy = (items: ServiceListItem[], filters: ActiveFiltersInfo): ServiceListItem[] => {
  let ret = items;
  const istioSidecar = getPresenceFilterValue(istioSidecarFilter, filters);
  if (istioSidecar !== undefined) {
    ret = filterByIstioSidecar(ret, istioSidecar);
  }

  const serviceNamesSelected = getFilterSelectedValues(serviceNameFilter, filters);
  if (serviceNamesSelected.length > 0) {
    ret = filterByName(ret, serviceNamesSelected);
  }

  const serviceTypeSelected = getFilterSelectedValues(serviceTypeFilter, filters);
  if (serviceTypeSelected.length > 0) {
    ret = filterByServiceType(ret, serviceTypeSelected);
  }

  const serviceFilterSelected = getFilterSelectedValues(labelFilter, filters);
  if (serviceFilterSelected.length > 0) {
    ret = filterByLabel(ret, serviceFilterSelected, filters.op) as ServiceListItem[];
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

const configurationToggle: ToggleType = {
  label: 'Configuration Validation',
  name: 'configuration',
  isChecked: true
};

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
  configurationToggle.isChecked = serverConfig.kialiFeatureFlags.uiDefaults.list.includeValidations;
  return [healthToggle, istioResourcesToggle, configurationToggle];
};

// Exported for test
export const sortServices = (
  services: ServiceListItem[],
  sortField: SortField<ServiceListItem>,
  isAscending: boolean
): ServiceListItem[] => {
  return services.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};
