import { ActiveFilter, FilterType, FILTER_ACTION_APPEND } from '../../types/Filters';
import { getRequestErrorsStatus, WithServiceHealth } from '../../types/Health';
import { ServiceListItem } from '../../types/ServiceList';
import { GenericSortField, HealthSortField } from '../../types/SortFilters';
import {
  istioSidecarFilter,
  healthFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth
} from '../../components/Filters/CommonFilters';

export const sortFields: GenericSortField<ServiceListItem>[] = [
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
    id: 'servicename',
    title: 'Service Name',
    isNumeric: false,
    param: 'sn',
    compare: (a, b) => a.name.localeCompare(b.name)
  },
  {
    id: 'istiosidecar',
    title: 'Istio Sidecar',
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
    compare: (a: WithServiceHealth<ServiceListItem>, b: WithServiceHealth<ServiceListItem>) => {
      const statusForA = a.health.getGlobalStatus();
      const statusForB = b.health.getGlobalStatus();

      if (statusForA.priority === statusForB.priority) {
        // If both services have same health status, use error rate to determine order.
        const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
        const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
        return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioB - ratioA;
      }

      return statusForB.priority - statusForA.priority;
    }
  } as HealthSortField<ServiceListItem>
];

const serviceNameFilter: FilterType = {
  id: 'servicename',
  title: 'Service Name',
  placeholder: 'Filter by Service Name',
  filterType: 'text',
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const availableFilters: FilterType[] = [serviceNameFilter, istioSidecarFilter, healthFilter];

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

export const filterBy = (
  items: ServiceListItem[],
  filters: ActiveFilter[]
): Promise<ServiceListItem[]> | ServiceListItem[] => {
  let ret = items;
  const istioSidecar = getPresenceFilterValue(istioSidecarFilter, filters);
  if (istioSidecar !== undefined) {
    ret = filterByIstioSidecar(ret, istioSidecar);
  }

  const serviceNamesSelected = getFilterSelectedValues(serviceNameFilter, filters);
  if (serviceNamesSelected.length > 0) {
    ret = filterByName(ret, serviceNamesSelected);
  }

  // We may have to perform a second round of filtering, using data fetched asynchronously (health)
  // If not, exit fast
  const healthSelected = getFilterSelectedValues(healthFilter, filters);
  if (healthSelected.length > 0) {
    return filterByHealth(ret, healthSelected);
  }
  return ret;
};

// Exported for test
export const sortServices = (
  services: ServiceListItem[],
  sortField: GenericSortField<ServiceListItem>,
  isAscending: boolean
): Promise<ServiceListItem[]> => {
  if (sortField.title === 'Health') {
    // In the case of health sorting, we may not have all health promises ready yet
    // So we need to get them all before actually sorting
    const allHealthPromises: Promise<WithServiceHealth<ServiceListItem>>[] = services.map(item => {
      return item.healthPromise.then((health): WithServiceHealth<ServiceListItem> => ({ ...item, health }));
    });
    return Promise.all(allHealthPromises).then(arr => {
      return arr.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    });
  }
  // Default case: sorting is done synchronously
  const sorted = services.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
  return Promise.resolve(sorted);
};
