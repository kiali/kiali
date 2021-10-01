import Namespace from './Namespace';
import {
  AuthorizationPolicy,
  DestinationRule,
  DestinationRules,
  EnvoyFilter,
  Gateway,
  ObjectValidation,
  PeerAuthentication,
  RequestAuthentication,
  ServiceEntry,
  Sidecar,
  Validations,
  VirtualService,
  VirtualServices,
  WorkloadEntry,
  WorkloadGroup
} from './IstioObjects';
import { ResourcePermissions } from './Permissions';

export interface IstioConfigItem {
  namespace: string;
  type: string;
  name: string;
  creationTimestamp?: string;
  resourceVersion?: string;
  gateway?: Gateway;
  virtualService?: VirtualService;
  destinationRule?: DestinationRule;
  serviceEntry?: ServiceEntry;
  authorizationPolicy?: AuthorizationPolicy;
  sidecar?: Sidecar;
  peerAuthentication?: PeerAuthentication;
  requestAuthentication?: RequestAuthentication;
  workloadEntry?: WorkloadEntry;
  workloadGroup?: WorkloadGroup;
  envoyFilter?: EnvoyFilter;
  validation?: ObjectValidation;
}

export interface IstioConfigList {
  namespace: Namespace;
  gateways: Gateway[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  serviceEntries: ServiceEntry[];
  workloadEntries: WorkloadEntry[];
  workloadGroups: WorkloadGroup[];
  envoyFilters: EnvoyFilter[];
  authorizationPolicies: AuthorizationPolicy[];
  sidecars: Sidecar[];
  peerAuthentications: PeerAuthentication[];
  requestAuthentications: RequestAuthentication[];
  permissions: { [key: string]: ResourcePermissions };
  validations: Validations;
}

export const dicIstioType = {
  Sidecar: 'sidecars',
  Gateway: 'gateways',
  VirtualService: 'virtualservices',
  DestinationRule: 'destinationrules',
  ServiceEntry: 'serviceentries',
  AuthorizationPolicy: 'authorizationpolicies',
  PeerAuthentication: 'peerauthentications',
  RequestAuthentication: 'requestauthentications',
  WorkloadEntry: 'workloadentries',
  WorkloadGroup: 'workloadgroups',
  EnvoyFilter: 'envoyfilters',

  gateways: 'Gateway',
  virtualservices: 'VirtualService',
  destinationrules: 'DestinationRule',
  serviceentries: 'ServiceEntry',
  authorizationpolicies: 'AuthorizationPolicy',
  sidecars: 'Sidecar',
  peerauthentications: 'PeerAuthentication',
  requestauthentications: 'RequestAuthentication',
  workloadentries: 'WorkloadEntry',
  workloadgroups: 'WorkloadGroup',
  envoyfilters: 'EnvoyFilter',

  gateway: 'Gateway',
  virtualservice: 'VirtualService',
  destinationrule: 'DestinationRule',
  serviceentry: 'ServiceEntry',
  authorizationpolicy: 'AuthorizationPolicy',
  sidecar: 'Sidecar',
  peerauthentication: 'PeerAuthentication',
  requestauthentication: 'RequestAuthentication',
  workloadentry: 'WorkloadEntry',
  workloadgroup: 'WorkloadGroup',
  envoyfilter: 'EnvoyFilter'
};

const includeName = (name: string, names: string[]) => {
  for (let i = 0; i < names.length; i++) {
    if (name.includes(names[i])) {
      return true;
    }
  }
  return false;
};

export const filterByName = (unfiltered: IstioConfigList, names: string[]): IstioConfigList => {
  if (names && names.length === 0) {
    return unfiltered;
  }
  return {
    namespace: unfiltered.namespace,
    gateways: unfiltered.gateways.filter(gw => includeName(gw.metadata.name, names)),
    virtualServices: {
      permissions: unfiltered.virtualServices.permissions,
      items: unfiltered.virtualServices.items.filter(vs => includeName(vs.metadata.name, names))
    },
    destinationRules: {
      permissions: unfiltered.destinationRules.permissions,
      items: unfiltered.destinationRules.items.filter(dr => includeName(dr.metadata.name, names))
    },
    serviceEntries: unfiltered.serviceEntries.filter(se => includeName(se.metadata.name, names)),
    authorizationPolicies: unfiltered.authorizationPolicies.filter(rc => includeName(rc.metadata.name, names)),
    sidecars: unfiltered.sidecars.filter(sc => includeName(sc.metadata.name, names)),
    peerAuthentications: unfiltered.peerAuthentications.filter(pa => includeName(pa.metadata.name, names)),
    requestAuthentications: unfiltered.requestAuthentications.filter(ra => includeName(ra.metadata.name, names)),
    workloadEntries: unfiltered.workloadEntries.filter(we => includeName(we.metadata.name, names)),
    workloadGroups: unfiltered.workloadGroups.filter(wg => includeName(wg.metadata.name, names)),
    envoyFilters: unfiltered.envoyFilters.filter(ef => includeName(ef.metadata.name, names)),
    validations: unfiltered.validations,
    permissions: unfiltered.permissions
  };
};

export const filterByConfigValidation = (unfiltered: IstioConfigItem[], configFilters: string[]): IstioConfigItem[] => {
  if (configFilters && configFilters.length === 0) {
    return unfiltered;
  }
  const filtered: IstioConfigItem[] = [];

  const filterByValid = configFilters.indexOf('Valid') > -1;
  const filterByNotValid = configFilters.indexOf('Not Valid') > -1;
  const filterByNotValidated = configFilters.indexOf('Not Validated') > -1;
  const filterByWarning = configFilters.indexOf('Warning') > -1;
  if (filterByValid && filterByNotValid && filterByNotValidated && filterByWarning) {
    return unfiltered;
  }

  unfiltered.forEach(item => {
    if (filterByValid && item.validation && item.validation.valid) {
      filtered.push(item);
    }
    if (filterByNotValid && item.validation && !item.validation.valid) {
      filtered.push(item);
    }
    if (filterByNotValidated && !item.validation) {
      filtered.push(item);
    }
    if (filterByWarning && item.validation && item.validation.checks.filter(i => i.severity === 'warning').length > 0) {
      filtered.push(item);
    }
  });
  return filtered;
};

export const toIstioItems = (istioConfigList: IstioConfigList): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];

  const hasValidations = (type: string, name: string) =>
    istioConfigList.validations[type] && istioConfigList.validations[type][name];

  const nonItems = ['validations', 'permissions', 'namespace'];

  Object.keys(istioConfigList).forEach(field => {
    if (nonItems.indexOf(field) > -1) {
      // These items do not belong to the IstioConfigItem[]
      return;
    }

    const typeNameProto = dicIstioType[field.toLowerCase()]; // ex. serviceEntries -> ServiceEntry
    const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
    const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

    let entries = istioConfigList[field];
    if (!(entries instanceof Array)) {
      // VirtualServices, DestinationRules
      entries = entries.items;
    }

    entries.forEach(entry => {
      const item = {
        namespace: istioConfigList.namespace.name,
        type: typeName,
        name: entry.metadata.name,
        creationTimestamp: entry.metadata.creationTimestamp,
        resourceVersion: entry.metadata.resourceVersion,
        validation: hasValidations(typeName, entry.metadata.name)
          ? istioConfigList.validations[typeName][entry.metadata.name]
          : undefined
      };

      item[entryName] = entry;
      istioItems.push(item);
    });
  });

  return istioItems;
};

export const vsToIstioItems = (vss: VirtualService[], validations: Validations): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (name: string) => validations.virtualservice && validations.virtualservice[name];

  const typeNameProto = dicIstioType['virtualservices']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  vss.forEach(vs => {
    const item = {
      namespace: vs.metadata.namespace || '',
      type: typeName,
      name: vs.metadata.name,
      creationTimestamp: vs.metadata.creationTimestamp,
      resourceVersion: vs.metadata.resourceVersion,
      validation: hasValidations(vs.metadata.name) ? validations.virtualservice[vs.metadata.name] : undefined
    };
    item[entryName] = vs;
    istioItems.push(item);
  });
  return istioItems;
};

export const drToIstioItems = (drs: DestinationRule[], validations: Validations): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (name: string) => validations.destinationrule && validations.destinationrule[name];

  const typeNameProto = dicIstioType['destinationrules']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  drs.forEach(dr => {
    const item = {
      namespace: dr.metadata.namespace || '',
      type: typeName,
      name: dr.metadata.name,
      creationTimestamp: dr.metadata.creationTimestamp,
      resourceVersion: dr.metadata.resourceVersion,
      validation: hasValidations(dr.metadata.name) ? validations.destinationrule[dr.metadata.name] : undefined
    };
    item[entryName] = dr;
    istioItems.push(item);
  });
  return istioItems;
};

export const gwToIstioItems = (gws: Gateway[], vss: VirtualService[], validations: Validations): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (name: string) => validations.gateway && validations.gateway[name];
  const vsGateways = new Set();

  const typeNameProto = dicIstioType['gateways']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  vss.forEach(vs => {
    vs.spec.gateways?.forEach(vsGatewayName => {
      if (vsGatewayName.indexOf('/') < 0) {
        vsGateways.add(vs.metadata.namespace + '/' + vsGatewayName);
      } else {
        vsGateways.add(vsGatewayName);
      }
    });
  });

  gws.forEach(gw => {
    if (vsGateways.has(gw.metadata.namespace + '/' + gw.metadata.name)) {
      const item = {
        namespace: gw.metadata.namespace || '',
        type: typeName,
        name: gw.metadata.name,
        creationTimestamp: gw.metadata.creationTimestamp,
        resourceVersion: gw.metadata.resourceVersion,
        validation: hasValidations(gw.metadata.name) ? validations.gateway[gw.metadata.name] : undefined
      };
      item[entryName] = gw;
      istioItems.push(item);
    }
  });
  return istioItems;
};
