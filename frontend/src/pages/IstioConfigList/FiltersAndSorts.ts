import { SortField } from '../../types/SortFilters';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { FILTER_ACTION_APPEND, FilterType, AllFilterTypes } from '../../types/Filters';

export const sortFields: SortField<IstioConfigItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
      return a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'istiotype',
    title: 'Istio Type',
    isNumeric: false,
    param: 'it',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'istioname',
    title: 'Istio Name',
    isNumeric: false,
    param: 'in',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
      // On same name order is not well defined, we need some fallback methods
      // This happens specially on adapters/templates where Istio 1.0.x calls them "handler"
      // So, we have a lot of objects with same namespace+name
      return a.name.localeCompare(b.name) || a.namespace.localeCompare(b.namespace) || a.type.localeCompare(b.type);
    }
  },
  {
    id: 'configvalidation',
    title: 'Config',
    isNumeric: false,
    param: 'cv',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
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
  }
];

export const istioNameFilter: FilterType = {
  category: 'Istio Name',
  placeholder: 'Filter by Istio Name',
  filterType: AllFilterTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

export const istioTypeFilter: FilterType = {
  category: 'Istio Type',
  placeholder: 'Filter by Istio Type',
  filterType: AllFilterTypes.typeAhead,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'AuthorizationPolicy',
      title: 'AuthorizationPolicy'
    },
    {
      id: 'DestinationRule',
      title: 'DestinationRule'
    },
    {
      id: 'EnvoyFilter',
      title: 'EnvoyFilter'
    },
    {
      id: 'Gateway',
      title: 'Gateway'
    },
    {
      id: 'PeerAuthentication',
      title: 'PeerAuthentication'
    },
    {
      id: 'RequestAuthentication',
      title: 'RequestAuthentication'
    },
    {
      id: 'ServiceEntry',
      title: 'ServiceEntry'
    },
    {
      id: 'Sidecar',
      title: 'Sidecar'
    },
    {
      id: 'VirtualService',
      title: 'VirtualService'
    },
    {
      id: 'WorkloadEntry',
      title: 'WorkloadEntry'
    },
    {
      id: 'WorkloadGroup',
      title: 'WorkloadGroup'
    }
  ]
};

export const configValidationFilter: FilterType = {
  category: 'Config',
  placeholder: 'Filter by Config Validation',
  filterType: AllFilterTypes.select,
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

export const availableFilters: FilterType[] = [istioTypeFilter, istioNameFilter, configValidationFilter];

export const sortIstioItems = (
  unsorted: IstioConfigItem[],
  sortField: SortField<IstioConfigItem>,
  isAscending: boolean
) => {
  return unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};
