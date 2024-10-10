import {
  AuthorizationPolicy,
  DestinationRule,
  EnvoyFilter,
  Gateway,
  K8sGateway,
  K8sGRPCRoute,
  K8sHTTPRoute,
  K8sReferenceGrant,
  K8sTCPRoute,
  K8sTLSRoute,
  K8sMetadata,
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
  WorkloadGroup,
  IstioObject,
  GroupVersionKind
} from './IstioObjects';
import { ResourcePermissions } from './Permissions';
import { getIstioObjectGVK, gvkToString } from '../utils/IstioConfigUtils';
import { TypeMeta } from './Kubernetes';

// @TODO rework to remove hardcoded object types, once REST API response JSON style is changed
export interface IstioConfigItem extends TypeMeta {
  authorizationPolicy?: AuthorizationPolicy;
  cluster?: string;
  creationTimestamp?: string;
  destinationRule?: DestinationRule;
  envoyFilter?: EnvoyFilter;
  gateway?: Gateway;
  k8sGRPCRoute?: K8sGRPCRoute;
  k8sGateway?: K8sGateway;
  k8sHTTPRoute?: K8sHTTPRoute;
  k8sReferenceGrant?: K8sReferenceGrant;
  k8sTCPRoute?: K8sTCPRoute;
  k8sTLSRoute?: K8sTLSRoute;
  name: string;
  namespace: string;
  peerAuthentication?: PeerAuthentication;
  requestAuthentication?: RequestAuthentication;
  resourceVersion?: string;
  serviceEntry?: ServiceEntry;
  sidecar?: Sidecar;
  telemetry?: Telemetry;
  validation?: ObjectValidation;
  virtualService?: VirtualService;
  wasmPlugin?: WasmPlugin;
  workloadEntry?: WorkloadEntry;
  workloadGroup?: WorkloadGroup;
}

// @TODO rework to remove hardcoded object types, once REST API response JSON style is changed
export interface IstioConfigList {
  authorizationPolicies: AuthorizationPolicy[];
  destinationRules: DestinationRule[];
  envoyFilters: EnvoyFilter[];
  gateways: Gateway[];
  k8sGRPCRoutes: K8sGRPCRoute[];
  k8sGateways: K8sGateway[];
  k8sHTTPRoutes: K8sHTTPRoute[];
  k8sReferenceGrants: K8sReferenceGrant[];
  k8sTCPRoutes: K8sTCPRoute[];
  k8sTLSRoutes: K8sTLSRoute[];
  peerAuthentications: PeerAuthentication[];
  permissions: { [key: string]: ResourcePermissions };
  requestAuthentications: RequestAuthentication[];
  serviceEntries: ServiceEntry[];
  sidecars: Sidecar[];
  telemetries: Telemetry[];
  validations: Validations;
  virtualServices: VirtualService[];
  wasmPlugins: WasmPlugin[];
  workloadEntries: WorkloadEntry[];
  workloadGroups: WorkloadGroup[];
}

export interface IstioConfigListQuery {
  labelSelector?: string;
  objects?: string;
  validate?: boolean;
  workloadSelector?: string;
}

export declare type IstioConfigsMap = { [key: string]: IstioConfigList };

export interface IstioConfigsMapQuery extends IstioConfigListQuery {
  namespaces?: string;
}

export const dicIstioTypeToGVK: { [key: string]: GroupVersionKind } = {
  AuthorizationPolicy: { Group: 'security.istio.io', Version: 'v1', Kind: 'AuthorizationPolicy' },
  PeerAuthentication: { Group: 'security.istio.io', Version: 'v1', Kind: 'PeerAuthentication' },
  RequestAuthentication: { Group: 'security.istio.io', Version: 'v1', Kind: 'RequestAuthentication' },

  DestinationRule: { Group: 'networking.istio.io', Version: 'v1', Kind: 'DestinationRule' },
  Gateway: { Group: 'networking.istio.io', Version: 'v1', Kind: 'Gateway' },
  EnvoyFilter: { Group: 'networking.istio.io', Version: 'v1alpha3', Kind: 'EnvoyFilter' },
  Sidecar: { Group: 'networking.istio.io', Version: 'v1', Kind: 'Sidecar' },
  ServiceEntry: { Group: 'networking.istio.io', Version: 'v1', Kind: 'ServiceEntry' },
  VirtualService: { Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' },
  WorkloadEntry: { Group: 'networking.istio.io', Version: 'v1', Kind: 'WorkloadEntry' },
  WorkloadGroup: { Group: 'networking.istio.io', Version: 'v1', Kind: 'WorkloadGroup' },

  WasmPlugin: { Group: 'extensions.istio.io', Version: 'v1alpha1', Kind: 'WasmPlugin' },
  Telemetry: { Group: 'telemetry.istio.io', Version: 'v1', Kind: 'Telemetry' },

  K8sGateway: { Group: 'gateway.networking.k8s.io', Version: 'v1', Kind: 'Gateway' },
  K8sGatewayClass: { Group: 'gateway.networking.k8s.io', Version: 'v1', Kind: 'GatewayClass' },
  K8sGRPCRoute: { Group: 'gateway.networking.k8s.io', Version: 'v1', Kind: 'GRPCRoute' },
  K8sHTTPRoute: { Group: 'gateway.networking.k8s.io', Version: 'v1', Kind: 'HTTPRoute' },
  K8sReferenceGrant: { Group: 'gateway.networking.k8s.io', Version: 'v1', Kind: 'ReferenceGrant' },
  K8sTCPRoute: { Group: 'gateway.networking.k8s.io', Version: 'v1alpha2', Kind: 'TCPRoute' },
  K8sTLSRoute: { Group: 'gateway.networking.k8s.io', Version: 'v1alpha2', Kind: 'TLSRoute' }
};

// @TODO should be removed once REST API response JSON style is changed
export const dicIstioType = {
  AuthorizationPolicy: 'authorizationpolicies',
  DestinationRule: 'destinationrules',
  EnvoyFilter: 'envoyfilters',
  Gateway: 'gateways',
  K8sGateway: 'k8sgateways',
  K8sGRPCRoute: 'k8sgrpcroutes',
  K8sHTTPRoute: 'k8shttproutes',
  K8sReferenceGrant: 'k8sreferencegrants',
  K8sTCPRoute: 'k8stcproutes',
  K8sTLSRoute: 'k8stlsroutes',
  PeerAuthentication: 'peerauthentications',
  RequestAuthentication: 'requestauthentications',
  serviceEntries: 'serviceentries',
  Sidecar: 'sidecars',
  Telemetry: 'telemetries',
  VirtualService: 'virtualservices',
  WasmPlugin: 'wasmPlugins',
  WorkloadEntry: 'workloadentries',
  WorkloadGroup: 'workloadgroups',

  authorizationpolicies: 'AuthorizationPolicy',
  destinationrules: 'DestinationRule',
  envoyfilters: 'EnvoyFilter',
  gateways: 'Gateway',
  k8sgateways: 'K8sGateway',
  k8sgrpcroutes: 'K8sGRPCRoute',
  k8shttproutes: 'K8sHTTPRoute',
  k8sreferencegrants: 'K8sReferenceGrant',
  k8stcproutes: 'K8sTCPRoute',
  k8stlsroutes: 'K8sTLSRoute',
  peerauthentications: 'PeerAuthentication',
  requestauthentications: 'RequestAuthentication',
  serviceentries: 'ServiceEntry',
  sidecars: 'Sidecar',
  telemetries: 'Telemetry',
  virtualservices: 'VirtualService',
  wasmplugins: 'WasmPlugin',
  workloadentries: 'WorkloadEntry',
  workloadgroups: 'WorkloadGroup',

  authorizationpolicy: 'AuthorizationPolicy',
  destinationrule: 'DestinationRule',
  envoyfilter: 'EnvoyFilter',
  gateway: 'Gateway',
  k8sgateway: 'K8sGateway',
  k8sgrpcroute: 'K8sGRPCRoute',
  k8shttproute: 'K8sHTTPRoute',
  k8sreferencegrant: 'K8sReferenceGrant',
  k8stcproute: 'K8sTCPRoute',
  k8stlsroute: 'K8sTLSRoute',
  peerauthentication: 'PeerAuthentication',
  requestauthentication: 'RequestAuthentication',
  serviceentry: 'ServiceEntry',
  sidecar: 'Sidecar',
  telemetry: 'Telemetry',
  virtualservice: 'VirtualService',
  wasmplugin: 'WasmPlugin',
  workloadentry: 'WorkloadEntry',
  workloadgroup: 'WorkloadGroup'
};

export function validationKey(name: string, namespace?: string): string {
  if (namespace !== undefined) {
    return `${name}.${namespace}`;
  } else {
    return name;
  }
}

const includeName = (name: string, names: string[]): boolean => {
  for (let i = 0; i < names.length; i++) {
    if (name.includes(names[i])) {
      return true;
    }
  }
  return false;
};

interface ObjectWithMetadata {
  metadata: K8sMetadata;
}

const includesNamespace = (item: ObjectWithMetadata, namespaces: Set<string>): boolean => {
  return item.metadata.namespace !== undefined && namespaces.has(item.metadata.namespace);
};

export const filterByNamespaces = (unfiltered: IstioConfigList, namespaces: string[]): IstioConfigList => {
  const namespaceSet = new Set(namespaces);
  return {
    gateways: unfiltered.gateways.filter(gw => includesNamespace(gw, namespaceSet)),
    k8sGateways: unfiltered.k8sGateways.filter(gw => includesNamespace(gw, namespaceSet)),
    k8sGRPCRoutes: unfiltered.k8sGRPCRoutes.filter(route => includesNamespace(route, namespaceSet)),
    k8sHTTPRoutes: unfiltered.k8sHTTPRoutes.filter(route => includesNamespace(route, namespaceSet)),
    k8sReferenceGrants: unfiltered.k8sReferenceGrants.filter(rg => includesNamespace(rg, namespaceSet)),
    k8sTCPRoutes: unfiltered.k8sTCPRoutes.filter(route => includesNamespace(route, namespaceSet)),
    k8sTLSRoutes: unfiltered.k8sTLSRoutes.filter(route => includesNamespace(route, namespaceSet)),
    virtualServices: unfiltered.virtualServices.filter(vs => includesNamespace(vs, namespaceSet)),
    destinationRules: unfiltered.destinationRules.filter(dr => includesNamespace(dr, namespaceSet)),
    serviceEntries: unfiltered.serviceEntries.filter(se => includesNamespace(se, namespaceSet)),
    authorizationPolicies: unfiltered.authorizationPolicies.filter(rc => includesNamespace(rc, namespaceSet)),
    sidecars: unfiltered.sidecars.filter(sc => includesNamespace(sc, namespaceSet)),
    peerAuthentications: unfiltered.peerAuthentications.filter(pa => includesNamespace(pa, namespaceSet)),
    requestAuthentications: unfiltered.requestAuthentications.filter(ra => includesNamespace(ra, namespaceSet)),
    workloadEntries: unfiltered.workloadEntries.filter(we => includesNamespace(we, namespaceSet)),
    workloadGroups: unfiltered.workloadGroups.filter(wg => includesNamespace(wg, namespaceSet)),
    envoyFilters: unfiltered.envoyFilters.filter(ef => includesNamespace(ef, namespaceSet)),
    wasmPlugins: unfiltered.wasmPlugins.filter(wp => includesNamespace(wp, namespaceSet)),
    telemetries: unfiltered.telemetries.filter(tm => includesNamespace(tm, namespaceSet)),
    validations: unfiltered.validations,
    permissions: unfiltered.permissions
  };
};

export const filterByName = (unfiltered: IstioConfigList, names: string[]): IstioConfigList => {
  if (names && names.length === 0) {
    return unfiltered;
  }

  return {
    gateways: unfiltered.gateways.filter(gw => includeName(gw.metadata.name, names)),
    k8sGateways: unfiltered.k8sGateways.filter(gw => includeName(gw.metadata.name, names)),
    k8sGRPCRoutes: unfiltered.k8sGRPCRoutes.filter(route => includeName(route.metadata.name, names)),
    k8sHTTPRoutes: unfiltered.k8sHTTPRoutes.filter(route => includeName(route.metadata.name, names)),
    k8sReferenceGrants: unfiltered.k8sReferenceGrants.filter(rg => includeName(rg.metadata.name, names)),
    k8sTCPRoutes: unfiltered.k8sTCPRoutes.filter(route => includeName(route.metadata.name, names)),
    k8sTLSRoutes: unfiltered.k8sTLSRoutes.filter(route => includeName(route.metadata.name, names)),
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

export const toIstioItems = (istioConfigList: IstioConfigList, cluster?: string): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];

  const hasValidations = (objectGVK: string, name: string, namespace?: string): ObjectValidation =>
    istioConfigList.validations[objectGVK] && istioConfigList.validations[objectGVK][validationKey(name, namespace)];

  const nonItems = ['validations', 'permissions', 'namespace', 'cluster'];

  Object.keys(istioConfigList).forEach(field => {
    if (nonItems.indexOf(field) > -1) {
      // These items do not belong to the IstioConfigItem[]
      return;
    }

    const typeNameProto = dicIstioType[field.toLowerCase()]; // ex. serviceEntries -> ServiceEntry
    const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

    let entries = istioConfigList[field];
    if (entries && !(entries instanceof Array)) {
      // VirtualServices, DestinationRules
      entries = entries.items;
    }

    if (!entries) {
      return;
    }

    entries.forEach((entry: IstioObject) => {
      const gvkString = gvkToString(getIstioObjectGVK(entry.apiVersion, entry.kind));
      const item = {
        namespace: entry.metadata.namespace ?? '',
        cluster: cluster,
        kind: entry.kind,
        apiVersion: entry.apiVersion,
        name: entry.metadata.name,
        creationTimestamp: entry.metadata.creationTimestamp,
        resourceVersion: entry.metadata.resourceVersion,
        validation: hasValidations(gvkString, entry.metadata.name, entry.metadata.namespace)
          ? istioConfigList.validations[gvkString][validationKey(entry.metadata.name, entry.metadata.namespace)]
          : undefined
      };

      item[entryName] = entry;
      istioItems.push(item);
    });
  });

  return istioItems;
};

export const vsToIstioItems = (
  vss: VirtualService[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation =>
    validations.virtualservice && validations.virtualservice[vKey];

  const typeNameProto = dicIstioType['virtualservices']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  vss.forEach(vs => {
    const vKey = validationKey(vs.metadata.name, vs.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: vs.metadata.namespace ?? '',
      kind: vs.kind,
      apiVersion: vs.apiVersion,
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
  drs: DestinationRule[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation =>
    validations.destinationrule && validations.destinationrule[vKey];

  const typeNameProto = dicIstioType['destinationrules']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  drs.forEach(dr => {
    const vKey = validationKey(dr.metadata.name, dr.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: dr.metadata.namespace ?? '',
      kind: dr.kind,
      apiVersion: dr.apiVersion,
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
  gws: Gateway[],
  vss: VirtualService[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.gateway && validations.gateway[vKey];
  const vsGateways = new Set();

  const typeNameProto = dicIstioType['gateways']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  vss.forEach(vs => {
    vs.spec.gateways?.forEach(vsGatewayName => {
      if (vsGatewayName.indexOf('/') < 0) {
        vsGateways.add(`${vs.metadata.namespace}/${vsGatewayName}`);
      } else {
        vsGateways.add(vsGatewayName);
      }
    });
  });

  gws.forEach(gw => {
    if (vsGateways.has(`${gw.metadata.namespace}/${gw.metadata.name}`)) {
      const vKey = validationKey(gw.metadata.name, gw.metadata.namespace);

      const item = {
        cluster: cluster,
        namespace: gw.metadata.namespace ?? '',
        kind: gw.kind,
        apiVersion: gw.apiVersion,
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
  gws: K8sGateway[],
  k8srs: K8sHTTPRoute[],
  k8sgrpcrs: K8sGRPCRoute[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.k8sgateway && validations.k8sgateway[vKey];
  const k8sGateways = new Set();

  const typeNameProto = dicIstioType['k8sgateways']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  k8srs.forEach(k8sr => {
    k8sr.spec.parentRefs?.forEach(parentRef => {
      if (!parentRef.namespace) {
        k8sGateways.add(`${k8sr.metadata.namespace}/${parentRef.name}`);
      } else {
        k8sGateways.add(`${parentRef.namespace}/${parentRef.name}`);
      }
    });
  });

  k8sgrpcrs.forEach(k8sr => {
    k8sr.spec.parentRefs?.forEach(parentRef => {
      if (!parentRef.namespace) {
        k8sGateways.add(`${k8sr.metadata.namespace}/${parentRef.name}`);
      } else {
        k8sGateways.add(`${parentRef.namespace}/${parentRef.name}`);
      }
    });
  });

  gws.forEach(gw => {
    if (k8sGateways.has(`${gw.metadata.namespace}/${gw.metadata.name}`)) {
      const vKey = validationKey(gw.metadata.name, gw.metadata.namespace);

      const item = {
        cluster: cluster,
        namespace: gw.metadata.namespace ?? '',
        kind: gw.kind,
        apiVersion: gw.apiVersion,
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

export const seToIstioItems = (see: ServiceEntry[], validations: Validations, cluster?: string): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.serviceentry && validations.serviceentry[vKey];

  const typeNameProto = dicIstioType['serviceentries']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  see.forEach(se => {
    const vKey = validationKey(se.metadata.name, se.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: se.metadata.namespace ?? '',
      kind: se.kind,
      apiVersion: se.apiVersion,
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
  routes: K8sHTTPRoute[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.k8shttproute && validations.k8shttproute[vKey];

  const typeNameProto = dicIstioType['k8shttproutes']; // ex. serviceEntries -> ServiceEntry
  const entryName = `${typeNameProto.charAt(0).toLowerCase()}${typeNameProto.slice(1)}`;

  routes.forEach(route => {
    const vKey = validationKey(route.metadata.name, route.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: route.metadata.namespace ?? '',
      kind: route.kind,
      apiVersion: route.apiVersion,
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

export const k8sGRPCRouteToIstioItems = (
  grpcRoutes: K8sGRPCRoute[],
  validations: Validations,
  cluster?: string
): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.k8sgrpcroute && validations.k8sgrpcroute[vKey];

  const typeNameProtoGRPC = dicIstioType['k8sgrpcroutes']; // ex. serviceEntries -> ServiceEntry
  const entryNameGRPC = `${typeNameProtoGRPC.charAt(0).toLowerCase()}${typeNameProtoGRPC.slice(1)}`;

  grpcRoutes.forEach(route => {
    const vKey = validationKey(route.metadata.name, route.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: route.metadata.namespace ?? '',
      kind: route.kind,
      apiVersion: route.apiVersion,
      name: route.metadata.name,
      creationTimestamp: route.metadata.creationTimestamp,
      resourceVersion: route.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.k8sgrpcroute[vKey] : undefined
    };

    item[entryNameGRPC] = route;
    istioItems.push(item);
  });

  return istioItems;
};
