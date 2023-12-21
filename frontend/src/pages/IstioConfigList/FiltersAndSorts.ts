import { SortField } from '../../types/SortFilters';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { FILTER_ACTION_APPEND, FilterType, AllFilterTypes, ToggleType } from '../../types/Filters';
import { serverConfig } from 'config';

export const sortFields: SortField<IstioConfigItem>[] = [
  {
    id: 'namespace',
    title: $t('Namespace'),
    isNumeric: false,
    param: 'ns',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
      return a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'type',
    title: $t('Type'),
    isNumeric: false,
    param: 'it',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'istioname',
    title: $t('Istio.IstioName', 'Istio Name'),
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
    title: $t('Config'),
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
  },
  {
    id: 'cluster',
    title: $t('Cluster'),
    isNumeric: false,
    param: 'cl',
    compare: (a: IstioConfigItem, b: IstioConfigItem) => {
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

export const istioNameFilter: FilterType = {
  category: 'Istio Name',
  placeholder: $t('Filter.IstioName', 'Filter by Istio Name'),
  filterType: AllFilterTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

// Used when Istio Config is implied
export const istioTypeFilter: FilterType = {
  category: 'Type',
  placeholder: $t('Filter.Type', 'Filter by Type'),
  filterType: AllFilterTypes.typeAhead,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'AuthorizationPolicy',
      title: $t('AuthorizationPolicy', 'Authorization Policy')
    },
    {
      id: 'DestinationRule',
      title: $t('DestinationRule')
    },
    {
      id: 'EnvoyFilter',
      title: $t('EnvoyFilter')
    },
    {
      id: 'Gateway',
      title: $t('Gateway')
    },
    {
      id: 'K8sGateway',
      title: $t('K8sGateway', 'Gateway (K8s)')
    },
    {
      id: 'K8sHTTPRoute',
      title: $t('K8sHTTPRoute', 'HTTPRoute (K8s)')
    },
    {
      id: 'PeerAuthentication',
      title: $t('PeerAuthentication')
    },
    {
      id: 'RequestAuthentication',
      title: $t('RequestAuthentication', 'Request Authentication')
    },
    {
      id: 'ServiceEntry',
      title: $t('ServiceEntry')
    },
    {
      id: 'Sidecar',
      title: $t('Sidecar')
    },
    {
      id: 'Telemetry',
      title: $t('Telemetry')
    },
    {
      id: 'VirtualService',
      title: $t('VirtualService')
    },
    {
      id: 'WasmPlugin',
      title: $t('WasmPlugin')
    },
    {
      id: 'WorkloadEntry',
      title: $t('WorkloadEntry')
    },
    {
      id: 'WorkloadGroup',
      title: $t('WorkloadGroup')
    }
  ]
};

// Used when Istio Config should be explicit
export const istioConfigTypeFilter = {
  ...istioTypeFilter,
  category: 'Istio Config Type',
  placeholder: $t('Filter.IstioConfigType', 'Filter by Istio Config Type')
};

export const configValidationFilter: FilterType = {
  category: 'Config',
  placeholder: $t('Filter.ConfigValidation', 'Filter by Config Validation'),
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'valid',
      title: $t('Valid')
    },
    {
      id: 'warning',
      title: $t('Warning')
    },
    {
      id: 'notvalid',
      title: $t('NotValid', 'Not Valid')
    },
    {
      id: 'notvalidated',
      title: $t('NotValidated', 'Not Validated')
    }
  ]
};

export const availableFilters: FilterType[] = [istioTypeFilter, istioNameFilter, configValidationFilter];

const configurationToggle: ToggleType = {
  label: $t('ConfigurationValidation', 'Configuration Validation'),
  name: 'configuration',
  isChecked: true
};

export const getAvailableToggles = (): ToggleType[] => {
  configurationToggle.isChecked = serverConfig.kialiFeatureFlags.uiDefaults.list.includeValidations;
  return [configurationToggle];
};

export const sortIstioItems = (
  unsorted: IstioConfigItem[],
  sortField: SortField<IstioConfigItem>,
  isAscending: boolean
) => {
  return unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};
