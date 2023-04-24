import Namespace from './Namespace';
import {
  AuthorizationPolicy,
  DestinationRule,
  EnvoyFilter,
  Gateway,
  K8sGateway,
  K8sHTTPRoute,
  ObjectValidation,
  PeerAuthentication,
  RequestAuthentication,
  ServiceEntry,
  Sidecar,
  WasmPlugin,
  Telemetry,
  Validations,
  VirtualService,
  WorkloadEntry,
  WorkloadGroup
} from './IstioObjects';
import { ResourcePermissions } from './Permissions';

export interface IstioConfigItem {
  namespace: string;
  cluster: string;
  type: string;
  name: string;
  creationTimestamp?: string;
  resourceVersion?: string;
  gateway?: Gateway;
  k8sGateway?: K8sGateway;
  k8sHTTPRoute?: K8sHTTPRoute;
  virtualService?: VirtualService;
  destinationRule?: DestinationRule;
  serviceEntry?: ServiceEntry;
  authorizationPolicy?: AuthorizationPolicy;
  sidecar?: Sidecar;
  wasmPlugin?: WasmPlugin;
  telemetry?: Telemetry;
  peerAuthentication?: PeerAuthentication;
  requestAuthentication?: RequestAuthentication;
  workloadEntry?: WorkloadEntry;
  workloadGroup?: WorkloadGroup;
  envoyFilter?: EnvoyFilter;
  validation?: ObjectValidation;
}

export declare type IstioConfigsMap = { [key: string]: IstioConfigList };

export interface IstioConfigList {
  namespace: Namespace;
  gateways: Gateway[];
  k8sGateways: K8sGateway[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  virtualServices: VirtualService[];
  destinationRules: DestinationRule[];
  serviceEntries: ServiceEntry[];
  workloadEntries: WorkloadEntry[];
  workloadGroups: WorkloadGroup[];
  envoyFilters: EnvoyFilter[];
  authorizationPolicies: AuthorizationPolicy[];
  sidecars: Sidecar[];
  wasmPlugins: WasmPlugin[];
  telemetries: Telemetry[];
  peerAuthentications: PeerAuthentication[];
  requestAuthentications: RequestAuthentication[];
  permissions: { [key: string]: ResourcePermissions };
  validations: Validations;
}

export const dicIstioType = {
  Sidecar: 'sidecars',
  Gateway: 'gateways',
  K8sGateway: 'k8sgateways',
  K8sHTTPRoute: 'k8shttproutes',
  VirtualService: 'virtualservices',
  DestinationRule: 'destinationrules',
  ServiceEntry: 'serviceentries',
  AuthorizationPolicy: 'authorizationpolicies',
  PeerAuthentication: 'peerauthentications',
  RequestAuthentication: 'requestauthentications',
  WorkloadEntry: 'workloadentries',
  WorkloadGroup: 'workloadgroups',
  EnvoyFilter: 'envoyfilters',
  WasmPlugin: 'wasmPlugins',
  Telemetry: 'telemetries',

  gateways: 'Gateway',
  k8sgateways: 'K8sGateway',
  k8shttproutes: 'K8sHTTPRoute',
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
  telemetries: 'Telemetry',
  wasmplugins: 'WasmPlugin',

  gateway: 'Gateway',
  k8sgateway: 'K8sGateway',
  k8shttproute: 'K8sHTTPRoute',
  virtualservice: 'VirtualService',
  destinationrule: 'DestinationRule',
  serviceentry: 'ServiceEntry',
  authorizationpolicy: 'AuthorizationPolicy',
  sidecar: 'Sidecar',
  wasmplugin: 'WasmPlugin',
  telemetry: 'Telemetry',
  peerauthentication: 'PeerAuthentication',
  requestauthentication: 'RequestAuthentication',
  workloadentry: 'WorkloadEntry',
  workloadgroup: 'WorkloadGroup',
  envoyfilter: 'EnvoyFilter'
};

export function validationKey(name: string, namespace?: string): string {
  if (namespace !== undefined) {
    return name + '.' + namespace;
  } else {
    return name;
  }
}

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
    k8sGateways: unfiltered.k8sGateways.filter(gw => includeName(gw.metadata.name, names)),
    k8sHTTPRoutes: unfiltered.k8sHTTPRoutes.filter(route => includeName(route.metadata.name, names)),
    virtualServices: unfiltered.virtualServices.filter(vs => includeName(vs.metadata.name, names)),
    destinationRules: unfiltered.destinationRules.filter(dr => includeName(dr.metadata.name, names)),
    serviceEntries: unfiltered.serviceEntries.filter(se => includeName(se.metadata.name, names)),
    authorizationPolicies: unfiltered.authorizationPolicies.filter(rc => includeName(rc.metadata.name, names)),
    sidecars: unfiltered.sidecars.filter(sc => includeName(sc.metadata.name, names)),
    peerAuthentications: unfiltered.peerAuthentications.filter(pa => includeName(pa.metadata.name, names)),
    requestAuthentications: unfiltered.requestAuthentications.filter(ra => includeName(ra.metadata.name, names)),
    workloadEntries: unfiltered.workloadEntries.filter(we => includeName(we.metadata.name, names)),
    workloadGroups: unfiltered.workloadGroups.filter(wg => includeName(wg.metadata.name, names)),
    envoyFilters: unfiltered.envoyFilters.filter(ef => includeName(ef.metadata.name, names)),
    wasmPlugins: unfiltered.wasmPlugins.filter(wp => includeName(wp.metadata.name, names)),
    telemetries: unfiltered.telemetries.filter(tm => includeName(tm.metadata.name, names)),
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

export const toIstioItems = (istioConfigList: IstioConfigList, cluster: string): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];

  const hasValidations = (type: string, name: string, namespace: string) =>
    istioConfigList.validations[type] && istioConfigList.validations[type][validationKey(name, namespace)];

  const nonItems = ['validations', 'permissions', 'namespace', 'cluster'];

  Object.keys(istioConfigList).forEach(field => {
    if (nonItems.indexOf(field) > -1) {
      // These items do not belong to the IstioConfigItem[]
      return;
    }

    const typeNameProto = dicIstioType[field.toLowerCase()]; // ex. serviceEntries -> ServiceEntry
    const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
    const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

    let entries = istioConfigList[field];
    if (entries && !(entries instanceof Array)) {
      // VirtualServices, DestinationRules
      entries = entries.items;
    }

    if (!entries) {
      return;
    }

    entries.forEach(entry => {
      const item = {
        namespace: istioConfigList.namespace.name,
        cluster: cluster,
        type: typeName,
        name: entry.metadata.name,
        creationTimestamp: entry.metadata.creationTimestamp,
        resourceVersion: entry.metadata.resourceVersion,
        validation: hasValidations(typeName, entry.metadata.name, entry.metadata.namespace)
          ? istioConfigList.validations[typeName][validationKey(entry.metadata.name, entry.metadata.namespace)]
          : undefined
      };

      item[entryName] = entry;
      istioItems.push(item);
    });
  });

  return istioItems;
};

export const vsToIstioItems = (cluster: string, vss: VirtualService[], validations: Validations): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.virtualservice && validations.virtualservice[vKey];

  const typeNameProto = dicIstioType['virtualservices']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  vss.forEach(vs => {
    const vKey = validationKey(vs.metadata.name, vs.metadata.namespace);
    const item = {
      cluster: cluster,
      namespace: vs.metadata.namespace || '',
      type: typeName,
      name: vs.metadata.name,
      creationTimestamp: vs.metadata.creationTimestamp,
      resourceVersion: vs.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.virtualservice[vKey] : undefined
    };
    item[entryName] = vs;
    istioItems.push(item);
  });
  return istioItems;
};

export const drToIstioItems = (
  cluster: string,
  drs: DestinationRule[],
  validations: Validations
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.destinationrule && validations.destinationrule[vKey];

  const typeNameProto = dicIstioType['destinationrules']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  drs.forEach(dr => {
    const vKey = validationKey(dr.metadata.name, dr.metadata.namespace);
    const item = {
      cluster: cluster,
      namespace: dr.metadata.namespace || '',
      type: typeName,
      name: dr.metadata.name,
      creationTimestamp: dr.metadata.creationTimestamp,
      resourceVersion: dr.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.destinationrule[vKey] : undefined
    };
    item[entryName] = dr;
    istioItems.push(item);
  });
  return istioItems;
};

export const gwToIstioItems = (
  cluster: string,
  gws: Gateway[],
  vss: VirtualService[],
  validations: Validations
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.gateway && validations.gateway[vKey];
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
      const vKey = validationKey(gw.metadata.name, gw.metadata.namespace);
      const item = {
        cluster: cluster,
        namespace: gw.metadata.namespace || '',
        type: typeName,
        name: gw.metadata.name,
        creationTimestamp: gw.metadata.creationTimestamp,
        resourceVersion: gw.metadata.resourceVersion,
        validation: hasValidations(vKey) ? validations.gateway[vKey] : undefined
      };
      item[entryName] = gw;
      istioItems.push(item);
    }
  });
  return istioItems;
};

export const k8sGwToIstioItems = (
  cluster: string,
  gws: K8sGateway[],
  k8srs: K8sHTTPRoute[],
  validations: Validations
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.k8sgateway && validations.k8sgateway[vKey];
  const k8sGateways = new Set();

  const typeNameProto = dicIstioType['k8sgateways']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  k8srs.forEach(k8sr => {
    k8sr.spec.parentRefs?.forEach(parentRef => {
      if (!parentRef.namespace) {
        k8sGateways.add(k8sr.metadata.namespace + '/' + parentRef.name);
      } else {
        k8sGateways.add(parentRef.namespace + '/' + parentRef.name);
      }
    });
  });

  gws.forEach(gw => {
    if (k8sGateways.has(gw.metadata.namespace + '/' + gw.metadata.name)) {
      const vKey = validationKey(gw.metadata.name, gw.metadata.namespace);
      const item = {
        cluster: cluster,
        namespace: gw.metadata.namespace || '',
        type: typeName,
        name: gw.metadata.name,
        creationTimestamp: gw.metadata.creationTimestamp,
        resourceVersion: gw.metadata.resourceVersion,
        validation: hasValidations(vKey) ? validations.k8sgateway[vKey] : undefined
      };
      item[entryName] = gw;
      istioItems.push(item);
    }
  });
  return istioItems;
};

export const seToIstioItems = (cluster: string, see: ServiceEntry[], validations: Validations): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.serviceentry && validations.serviceentry[vKey];

  const typeNameProto = dicIstioType['serviceentries']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  see.forEach(se => {
    const vKey = validationKey(se.metadata.name, se.metadata.namespace);
    const item = {
      cluster: cluster,
      namespace: se.metadata.namespace || '',
      type: typeName,
      name: se.metadata.name,
      creationTimestamp: se.metadata.creationTimestamp,
      resourceVersion: se.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.serviceentry[vKey] : undefined
    };
    item[entryName] = se;
    istioItems.push(item);
  });
  return istioItems;
};

export const k8sHTTPRouteToIstioItems = (
  cluster: string,
  routes: K8sHTTPRoute[],
  validations: Validations
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string) => validations.k8shttproute && validations.k8shttproute[vKey];

  const typeNameProto = dicIstioType['k8shttproutes']; // ex. serviceEntries -> ServiceEntry
  const typeName = typeNameProto.toLowerCase(); // ex. ServiceEntry -> serviceentry
  const entryName = typeNameProto.charAt(0).toLowerCase() + typeNameProto.slice(1);

  routes.forEach(route => {
    const vKey = validationKey(route.metadata.name, route.metadata.namespace);
    const item = {
      cluster: cluster,
      namespace: route.metadata.namespace || '',
      type: typeName,
      name: route.metadata.name,
      creationTimestamp: route.metadata.creationTimestamp,
      resourceVersion: route.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.k8shttproute[vKey] : undefined
    };
    item[entryName] = route;
    istioItems.push(item);
  });
  return istioItems;
};
