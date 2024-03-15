import { SortField } from '../../types/SortFilters';
import { IstioConfigItem } from '../../types/IstioConfigList';
import { FILTER_ACTION_APPEND, FilterType, AllFilterTypes, ToggleType } from '../../types/Filters';
import { serverConfig } from 'config';

export const sortFields: SortField<IstioConfigItem>[] = [
  {
    id: 'namespace',
    title: 'Namespace',
    isNumeric: false,
    param: 'ns',
    compare: (a: IstioConfigItem, b: IstioConfigItem): number => {
      return a.namespace.localeCompare(b.namespace) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'type',
    title: 'Type',
    isNumeric: false,
    param: 'it',
    compare: (a: IstioConfigItem, b: IstioConfigItem): number => {
      return a.type.localeCompare(b.type) || a.name.localeCompare(b.name);
    }
  },
  {
    id: 'istioname',
    title: 'Istio Name',
    isNumeric: false,
    param: 'in',
    compare: (a: IstioConfigItem, b: IstioConfigItem): number => {
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
    compare: (a: IstioConfigItem, b: IstioConfigItem): number => {
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
    compare: (a: IstioConfigItem, b: IstioConfigItem): number => {
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
  placeholder: 'Filter by Istio Name',
  filterType: AllFilterTypes.text,
  action: FILTER_ACTION_APPEND,
  filterValues: []
};

// Used when Istio Config is implied
export const istioTypeFilter: FilterType = {
  category: 'Type',
  placeholder: 'Filter by Type',
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
      id: 'K8sGateway',
      title: 'K8sGateway'
    },
    {
      id: 'K8sGRPCRoute',
      title: 'K8sGRPCRoute'
    },
    {
      id: 'K8sHTTPRoute',
      title: 'K8sHTTPRoute'
    },
    {
      id: 'K8sReferenceGrant',
      title: 'K8sReferenceGrant'
    },
    {
      id: 'K8sTCPRoute',
      title: 'K8sTCPRoute'
    },
    {
      id: 'K8sTLSRoute',
      title: 'K8sTLSRoute'
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
      id: 'Telemetry',
      title: 'Telemetry'
    },
    {
      id: 'VirtualService',
      title: 'VirtualService'
    },
    {
      id: 'WasmPlugin',
      title: 'WasmPlugin'
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

// Used when Istio Config should be explicit
export const istioConfigTypeFilter = {
  ...istioTypeFilter,
  category: 'Istio Config Type',
  placeholder: 'Filter by Istio Config Type'
};

export const configValidationFilter: FilterType = {
  category: 'Config',
  placeholder: 'Filter by Config Validation',
  filterType: AllFilterTypes.select,
  action: FILTER_ACTION_APPEND,
  filterValues: [
    {
      id: 'Valid',
      title: 'Valid'
    },
    {
      id: 'Warning',
      title: 'Warning'
    },
    {
      id: 'Not Valid',
      title: 'Not Valid'
    },
    {
      id: 'Not Validated',
      title: 'Not Validated'
    }
  ]
};

export const availableFilters: FilterType[] = [istioTypeFilter, istioNameFilter, configValidationFilter];

const configurationToggle: ToggleType = {
  label: 'Configuration Validation',
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
): IstioConfigItem[] => {
  return unsorted.sort(isAscending ? sortField.compare : (a, b) => sortField.compare(b, a));
};
