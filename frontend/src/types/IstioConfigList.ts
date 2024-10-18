import {
  DestinationRule,
  Gateway,
  K8sGateway,
  K8sGRPCRoute,
  K8sHTTPRoute,
  K8sMetadata,
  ObjectValidation,
  ServiceEntry,
  Validations,
  VirtualService,
  IstioObject,
  GroupVersionKind
} from './IstioObjects';
import { ResourcePermissions } from './Permissions';
import { getIstioObjectGVK, gvkToString } from '../utils/IstioConfigUtils';
import { TypeMeta } from './Kubernetes';

export interface IstioConfigItem extends TypeMeta {
  cluster?: string;
  creationTimestamp?: string;
  name: string;
  namespace: string;
  resource: any;
  resourceVersion?: string;
  validation?: ObjectValidation;
}

export interface IstioConfigList {
  permissions: { [key: string]: ResourcePermissions };
  resources: { [key: string]: any[] }; // map of gvk to resource array
  validations: Validations;
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
  const filteredResources: { [key: string]: any[] } = {};

  // Iterate over dicIstioTypeToGVK to dynamically filter each resource by namespace
  Object.keys(dicIstioTypeToGVK).forEach(key => {
    const resourceKey = gvkToString(dicIstioTypeToGVK[key]);

    // Check if the resource exists in the unfiltered list, then filter by namespace
    if (unfiltered.resources[resourceKey]) {
      filteredResources[resourceKey] = unfiltered.resources[resourceKey].filter(resource =>
        includesNamespace(resource, namespaceSet)
      );
    }
  });

  return {
    resources: filteredResources,
    validations: unfiltered.validations,
    permissions: unfiltered.permissions
  };
};

export const filterByName = (unfiltered: IstioConfigList, names: string[]): IstioConfigList => {
  if (names && names.length === 0) {
    return unfiltered;
  }

  const filteredResources: { [key: string]: any[] } = {};

  // Iterate over the dicIstioTypeToGVK to access each resource type dynamically
  Object.keys(dicIstioTypeToGVK).forEach(key => {
    const resourceKey = gvkToString(dicIstioTypeToGVK[key]);

    // Check if the resource exists in the unfiltered list, then filter by names
    if (unfiltered.resources[resourceKey]) {
      filteredResources[resourceKey] = unfiltered.resources[resourceKey].filter(resource =>
        includeName(resource.metadata.name, names)
      );
    }
  });

  return {
    resources: filteredResources,
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

  const resources = istioConfigList['resources'];
  Object.keys(resources).forEach(field => {
    let entries = resources[field];

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
        resource: entry,
        resourceVersion: entry.metadata.resourceVersion,
        validation: hasValidations(gvkString, entry.metadata.name, entry.metadata.namespace)
          ? istioConfigList.validations[gvkString][validationKey(entry.metadata.name, entry.metadata.namespace)]
          : undefined
      };

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

  vss.forEach(vs => {
    const vKey = validationKey(vs.metadata.name, vs.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: vs.metadata.namespace ?? '',
      kind: vs.kind,
      apiVersion: vs.apiVersion,
      name: vs.metadata.name,
      creationTimestamp: vs.metadata.creationTimestamp,
      resource: vs,
      resourceVersion: vs.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.virtualservice[vKey] : undefined
    };

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

  drs.forEach(dr => {
    const vKey = validationKey(dr.metadata.name, dr.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: dr.metadata.namespace ?? '',
      kind: dr.kind,
      apiVersion: dr.apiVersion,
      name: dr.metadata.name,
      creationTimestamp: dr.metadata.creationTimestamp,
      resource: dr,
      resourceVersion: dr.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.destinationrule[vKey] : undefined
    };

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
        resource: gw,
        resourceVersion: gw.metadata.resourceVersion,
        validation: hasValidations(vKey) ? validations.gateway[vKey] : undefined
      };

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
        resource: gw,
        resourceVersion: gw.metadata.resourceVersion,
        validation: hasValidations(vKey) ? validations.k8sgateway[vKey] : undefined
      };

      istioItems.push(item);
    }
  });

  return istioItems;
};

export const seToIstioItems = (see: ServiceEntry[], validations: Validations, cluster?: string): IstioConfigItem[] => {
  const istioItems: IstioConfigItem[] = [];
  const hasValidations = (vKey: string): ObjectValidation => validations.serviceentry && validations.serviceentry[vKey];

  see.forEach(se => {
    const vKey = validationKey(se.metadata.name, se.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: se.metadata.namespace ?? '',
      kind: se.kind,
      apiVersion: se.apiVersion,
      name: se.metadata.name,
      creationTimestamp: se.metadata.creationTimestamp,
      resource: se,
      resourceVersion: se.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.serviceentry[vKey] : undefined
    };

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

  routes.forEach(route => {
    const vKey = validationKey(route.metadata.name, route.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: route.metadata.namespace ?? '',
      kind: route.kind,
      apiVersion: route.apiVersion,
      name: route.metadata.name,
      creationTimestamp: route.metadata.creationTimestamp,
      resource: route,
      resourceVersion: route.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.k8shttproute[vKey] : undefined
    };

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

  grpcRoutes.forEach(route => {
    const vKey = validationKey(route.metadata.name, route.metadata.namespace);

    const item = {
      cluster: cluster,
      namespace: route.metadata.namespace ?? '',
      kind: route.kind,
      apiVersion: route.apiVersion,
      name: route.metadata.name,
      creationTimestamp: route.metadata.creationTimestamp,
      resource: route,
      resourceVersion: route.metadata.resourceVersion,
      validation: hasValidations(vKey) ? validations.k8sgrpcroute[vKey] : undefined
    };

    istioItems.push(item);
  });

  return istioItems;
};
