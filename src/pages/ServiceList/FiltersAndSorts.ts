import { ActiveFilter, FilterType, FILTER_ACTION_APPEND } from '../../types/Filters';
import { getRequestErrorsStatus, ServiceHealth } from '../../types/Health';
import { ServiceListItem } from '../../types/ServiceList';
import { SortField } from '../../types/SortFilters';
import NamespaceFilter from '../../components/Filters/NamespaceFilter';
import {
  istioSidecarFilter,
  healthFilter,
  getPresenceFilterValue,
  getFilterSelectedValues,
  filterByHealth
} from '../../components/Filters/CommonFilters';

type ServiceItemHealth = ServiceListItem & { health: ServiceHealth };

export namespace ServiceListFilters {
  export const sortFields: SortField<ServiceListItem>[] = [
    {
      id: 'namespace',
      title: 'Namespace',
      isNumeric: false,
      param: 'ns',
      compare: (a: ServiceListItem, b: ServiceListItem) => {
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
      id: 'istiosidecar',
      title: 'Istio Sidecar',
      isNumeric: false,
      param: 'is',
      compare: (a: ServiceListItem, b: ServiceListItem) => {
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
      id: 'errorate',
      title: 'Error Rate',
      isNumeric: true,
      param: 'er',
      compare: (a: ServiceItemHealth, b: ServiceItemHealth) => {
        const ratioA = getRequestErrorsStatus(a.health.requests.errorRatio).value;
        const ratioB = getRequestErrorsStatus(b.health.requests.errorRatio).value;
        return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
      }
    }
  ];

  const serviceNameFilter: FilterType = {
    id: 'servicename',
    title: 'Service Name',
    placeholder: 'Filter by Service Name',
    filterType: 'text',
    action: FILTER_ACTION_APPEND,
    filterValues: []
  };

  export const availableFilters: FilterType[] = [
    NamespaceFilter.create(),
    serviceNameFilter,
    istioSidecarFilter,
    healthFilter
  ];
  export const namespaceFilter = availableFilters[0];

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
    sortField: SortField<ServiceListItem>,
    isAscending: boolean
  ): Promise<ServiceListItem[]> => {
    if (sortField.title === 'Error Rate') {
      // In the case of error rate sorting, we may not have all health promises ready yet
      // So we need to get them all before actually sorting
      const allHealthPromises: Promise<ServiceItemHealth>[] = services.map(item => {
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
    // Default case: sorting is done synchronously
    const sorted = services.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
    return Promise.resolve(sorted);
  };
}
