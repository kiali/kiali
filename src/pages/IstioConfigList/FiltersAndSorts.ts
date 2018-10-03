import { SortField } from '../../types/SortFilters';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { FILTER_ACTION_APPEND, FILTER_ACTION_UPDATE, FilterType } from '../../types/Filters';
import NamespaceFilter from '../../components/Filters/NamespaceFilter';

export namespace IstioConfigListFilters {
  export const sortFields: SortField<IstioConfigItem>[] = [
    {
      id: 'namespace',
      title: 'Namespace',
      isNumeric: false,
      param: 'ns',
      compare: (a: IstioConfigItem, b: IstioConfigItem) => 1
    },
    {
      id: 'istiotype',
      title: 'Istio Type',
      isNumeric: false,
      param: 'it',
      compare: (a: IstioConfigItem, b: IstioConfigItem) => 1
    },
    {
      id: 'istioname',
      title: 'Istio Name',
      isNumeric: false,
      param: 'in',
      compare: (a: IstioConfigItem, b: IstioConfigItem) => 1
    },
    {
      id: 'configvalidation',
      title: 'Config',
      isNumeric: false,
      param: 'cv',
      compare: (a: IstioConfigItem, b: IstioConfigItem) => 1
    }
  ];

  const istioNameFilter: FilterType = {
    id: 'istioname',
    title: 'Istio Name',
    placeholder: 'Filter by Istio Name',
    filterType: 'text',
    action: FILTER_ACTION_UPDATE,
    filterValues: []
  };

  const istioTypeFilter: FilterType = {
    id: 'istiotype',
    title: 'Istio Type',
    placeholder: 'Filter by Istio Type',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: [
      {
        id: 'Gateway',
        title: 'Gateway'
      },
      {
        id: 'VirtualService',
        title: 'VirtualService'
      },
      {
        id: 'DestinationRule',
        title: 'DestinationRule'
      },
      {
        id: 'ServiceEntry',
        title: 'ServiceEntry'
      },
      {
        id: 'Rule',
        title: 'Rule'
      },
      {
        id: 'QuotaSpec',
        title: 'QuotaSpec'
      },
      {
        id: 'QuotaSpecBinding',
        title: 'QuotaSpecBinding'
      }
    ]
  };

  const configValidationFilter: FilterType = {
    id: 'configvalidation',
    title: 'Config',
    placeholder: 'Filter by Config Validation',
    filterType: 'select',
    action: FILTER_ACTION_APPEND,
    filterValues: [
      {
        id: 'valid',
        title: 'Valid'
      },
      {
        id: 'warning',
        title: 'Warning'
      },
      {
        id: 'notvalid',
        title: 'Not Valid'
      },
      {
        id: 'notvalidated',
        title: 'Not Validated'
      }
    ]
  };

  export const availableFilters: FilterType[] = [
    NamespaceFilter.create(),
    istioTypeFilter,
    istioNameFilter,
    configValidationFilter
  ];

  export const sortIstioItems = (
    unsorted: IstioConfigItem[],
    sortField: SortField<IstioConfigItem>,
    isAscending: boolean
  ) => {
    const sortPromise: Promise<IstioConfigItem[]> = new Promise((resolve, reject) => {
      resolve(
        unsorted.sort((a: IstioConfigItem, b: IstioConfigItem) => {
          let sortValue = -1;
          if (sortField.id === 'namespace') {
            sortValue = a.namespace.localeCompare(b.namespace);
          }
          if (sortField.id === 'istiotype') {
            sortValue = a.type.localeCompare(b.type);
          }
          if (sortField.id === 'configvalidation') {
            if (a.validation && !b.validation) {
              sortValue = -1;
            }
            if (!a.validation && b.validation) {
              sortValue = 1;
            }
            if (!a.validation && !b.validation) {
              sortValue = 0;
            }
            if (a.validation && b.validation) {
              if (a.validation.valid && !b.validation.valid) {
                sortValue = -1;
              }
              if (!a.validation.valid && b.validation.valid) {
                sortValue = 1;
              }
              if (a.validation.valid && b.validation.valid) {
                sortValue = 0;
              }
              if (!a.validation.valid && !b.validation.valid) {
                sortValue = b.validation.checks.length - a.validation.checks.length;
              }
            }
          }
          // Istioname at the end to be the default sort when sortValue === 0
          if (sortField.id === 'istioname' || sortValue === 0) {
            sortValue = a.name.localeCompare(b.name);
          }
          return isAscending ? sortValue : sortValue * -1;
        })
      );
    });

    return sortPromise;
  };
}
