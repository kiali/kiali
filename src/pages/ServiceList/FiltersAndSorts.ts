import { ActiveFilter, FilterType, presenceValues } from '../../types/Filters';
import { getRequestErrorsRatio, ServiceHealth } from '../../types/Health';
import { ServiceListItem } from '../../types/ServiceList';
import { SortField } from '../../types/SortFilters';
import { removeDuplicatesArray } from '../../utils/Common';
import NamespaceFilter from '../../components/Filters/NamespaceFilter';

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
        const ratioA = getRequestErrorsRatio(a.health.requests).value;
        const ratioB = getRequestErrorsRatio(b.health.requests).value;
        return ratioA === ratioB ? a.name.localeCompare(b.name) : ratioA - ratioB;
      }
    }
  ];

  const serviceNameFilter: FilterType = {
    id: 'servicename',
    title: 'Service Name',
    placeholder: 'Filter by Service Name',
    filterType: 'text',
    action: 'append',
    filterValues: []
  };

  const istioFilter: FilterType = {
    id: 'istio',
    title: 'Istio Sidecar',
    placeholder: 'Filter by Istio Sidecar',
    filterType: 'select',
    action: 'update',
    filterValues: presenceValues
  };

  export const availableFilters: FilterType[] = [NamespaceFilter.create(), serviceNameFilter, istioFilter];

  const filterByIstioSidecar = (items: ServiceListItem[], istioSidecar: boolean): ServiceListItem[] => {
    return items.filter(item => item.istioSidecar === istioSidecar);
  };

  const filterByName = (items: ServiceListItem[], names: string[]): ServiceListItem[] => {
    let result = items;
    result = result.filter(item => {
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
    return result;
  };

  export const filterBy = (items: ServiceListItem[], filters: ActiveFilter[]) => {
    let results = items;
    /** Get ServiceName filter */
    let serviceNamesSelected: string[] = filters
      .filter(activeFilter => activeFilter.category === 'Service Name')
      .map(activeFilter => activeFilter.value);

    /** Remove duplicates  */
    serviceNamesSelected = removeDuplicatesArray(serviceNamesSelected);

    /** Get IstioSidecar filter */
    let istioSidecarValidationFilters: ActiveFilter[] = filters.filter(
      activeFilter => activeFilter.category === 'Istio Sidecar'
    );
    let istioSidecar: boolean | undefined = undefined;

    if (istioSidecarValidationFilters.length > 0) {
      istioSidecar = istioSidecarValidationFilters[0].value === 'Present';
      results = filterByIstioSidecar(results, istioSidecar);
    }

    if (serviceNamesSelected.length > 0) {
      results = filterByName(results, serviceNamesSelected);
    }
    return results;
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
