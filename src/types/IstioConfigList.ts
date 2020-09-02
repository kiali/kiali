import Namespace from './Namespace';
import {
  AttributeManifest,
  AuthorizationPolicy,
  ClusterRbacConfig,
  DestinationRule,
  DestinationRules,
  EnvoyFilter,
  Gateway,
  HTTPAPISpec,
  HTTPAPISpecBinding,
  IstioAdapter,
  IstioHandler,
  IstioInstance,
  IstioRule,
  IstioTemplate,
  ObjectValidation,
  PeerAuthentication,
  Policy,
  QuotaSpec,
  QuotaSpecBinding,
  RbacConfig,
  RequestAuthentication,
  ServiceEntry,
  ServiceMeshRbacConfig,
  ServiceRole,
  ServiceRoleBinding,
  Sidecar,
  Validations,
  VirtualService,
  VirtualServices,
  WorkloadEntry
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
  rule?: IstioRule;
  adapter?: IstioAdapter;
  template?: IstioTemplate;
  handler?: IstioHandler;
  instance?: IstioInstance;
  quotaSpec?: QuotaSpec;
  quotaSpecBinding?: QuotaSpecBinding;
  policy?: Policy;
  meshPolicy?: Policy;
  serviceMeshPolicy?: Policy;
  clusterRbacConfig?: ClusterRbacConfig;
  rbacConfig?: RbacConfig;
  authorizationPolicy?: AuthorizationPolicy;
  serviceMeshRbacConfig?: ServiceMeshRbacConfig;
  sidecar?: Sidecar;
  serviceRole?: ServiceRole;
  serviceRoleBinding?: ServiceRoleBinding;
  peerAuthentication?: PeerAuthentication;
  requestAuthentication?: RequestAuthentication;
  workloadEntry?: WorkloadEntry;
  envoyFilter?: EnvoyFilter;
  attributeManifest?: AttributeManifest;
  httpApiSpec?: HTTPAPISpec;
  httpApiSpecBinding?: HTTPAPISpecBinding;
  validation?: ObjectValidation;
}

export interface IstioConfigList {
  namespace: Namespace;
  gateways: Gateway[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  serviceEntries: ServiceEntry[];
  workloadEntries: WorkloadEntry[];
  envoyFilters: EnvoyFilter[];
  rules: IstioRule[];
  adapters: IstioAdapter[];
  templates: IstioTemplate[];
  instances: IstioInstance[];
  handlers: IstioHandler[];
  quotaSpecs: QuotaSpec[];
  quotaSpecBindings: QuotaSpecBinding[];
  attributeManifests: AttributeManifest[];
  httpApiSpecs: HTTPAPISpec[];
  httpApiSpecBindings: HTTPAPISpecBinding[];
  policies: Policy[];
  meshPolicies: Policy[];
  serviceMeshPolicies: Policy[];
  clusterRbacConfigs: ClusterRbacConfig[];
  rbacConfigs: RbacConfig[];
  authorizationPolicies: AuthorizationPolicy[];
  serviceMeshRbacConfigs: ServiceMeshRbacConfig[];
  sidecars: Sidecar[];
  serviceRoles: ServiceRole[];
  serviceRoleBindings: ServiceRoleBinding[];
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
  Rule: 'rules',
  Adapter: 'adapters',
  Template: 'templates',
  Handler: 'handlers',
  Instance: 'instances',
  QuotaSpec: 'quotaspecs',
  QuotaSpecBinding: 'quotaspecbindings',
  Policy: 'policies',
  MeshPolicy: 'meshpolicies',
  ClusterRbacConfig: 'clusterrbacconfigs',
  RbacConfig: 'rbacconfigs',
  AuthorizationPolicy: 'authorizationpolicies',
  ServiceRole: 'serviceroles',
  ServiceRoleBinding: 'servicerolebindings',
  ServiceMeshPolicy: 'servicemeshpolicies',
  ServiceMeshRbacConfig: 'servicemeshrbacconfigs',
  PeerAuthentication: 'peerauthentications',
  RequestAuthentication: 'requestauthentications',
  WorkloadEntry: 'workloadentries',
  EnvoyFilter: 'envoyfilters',
  AttributeManifest: 'attributemanifests',
  HTTPAPISpec: 'httpapispecs',
  HTTPAPISpecBinding: 'httpapispecbindings',
  gateways: 'Gateway',
  virtualservices: 'VirtualService',
  destinationrules: 'DestinationRule',
  serviceentries: 'ServiceEntry',
  rules: 'Rule',
  adapters: 'Adapter',
  templates: 'Template',
  quotaspecs: 'QuotaSpec',
  quotaspecbindings: 'QuotaSpecBinding',
  instances: 'Instance',
  handlers: 'Handler',
  policies: 'Policy',
  meshpolicies: 'MeshPolicy',
  clusterrbacconfigs: 'ClusterRbacConfig',
  rbacconfigs: 'RbacConfig',
  authorizationpolicies: 'AuthorizationPolicy',
  sidecars: 'Sidecar',
  serviceroles: 'ServiceRole',
  servicerolebindings: 'ServiceRoleBinding',
  servicemeshpolicies: 'ServiceMeshPolicy',
  servicemeshrbacconfigs: 'ServiceMeshRbacConfig',
  peerauthentications: 'PeerAuthentication',
  requestauthentications: 'RequestAuthentication',
  workloadentries: 'WorkloadEntry',
  envoyfilters: 'EnvoyFilter',
  attributemanifests: 'AttributeManifest',
  httpapispecs: 'HTTPAPISpec',
  httpapispecbindings: 'HTTPAPISpecBinding',
  gateway: 'Gateway',
  virtualservice: 'VirtualService',
  destinationrule: 'DestinationRule',
  serviceentry: 'ServiceEntry',
  rule: 'Rule',
  adapter: 'Adapter',
  template: 'Template',
  quotaspec: 'QuotaSpec',
  quotaspecbinding: 'QuotaSpecBinding',
  instance: 'Instance',
  handler: 'Handler',
  policy: 'Policy',
  meshpolicy: 'MeshPolicy',
  clusterrbacconfig: 'ClusterRbacConfig',
  rbacconfig: 'RbacConfig',
  authorizationpolicy: 'AuthorizationPolicy',
  sidecar: 'Sidecar',
  servicerole: 'ServiceRole',
  servicerolebinding: 'ServiceRoleBinding',
  servicemeshpolicy: 'ServiceMeshPolicy',
  servicemeshrbacconfig: 'ServiceMeshRbacConfig',
  peerauthentication: 'PeerAuthentication',
  requestauthentication: 'RequestAuthentication',
  workloadentry: 'WorkloadEntry',
  envoyfilter: 'EnvoyFilter',
  attributemanifest: 'AttributeManifest',
  httpapispec: 'HTTPAPISpec',
  httpapispecbinding: 'HTTPAPISpecBinding'
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
    rules: unfiltered.rules.filter(r => includeName(r.metadata.name, names)),
    adapters: unfiltered.adapters.filter(r => includeName(r.metadata.name, names)),
    templates: unfiltered.templates.filter(r => includeName(r.metadata.name, names)),
    handlers: unfiltered.handlers.filter(r => includeName(r.metadata.name, names)),
    instances: unfiltered.instances.filter(r => includeName(r.metadata.name, names)),
    quotaSpecs: unfiltered.quotaSpecs.filter(qs => includeName(qs.metadata.name, names)),
    quotaSpecBindings: unfiltered.quotaSpecBindings.filter(qsb => includeName(qsb.metadata.name, names)),
    policies: unfiltered.policies.filter(p => includeName(p.metadata.name, names)),
    meshPolicies: unfiltered.meshPolicies.filter(p => includeName(p.metadata.name, names)),
    serviceMeshPolicies: unfiltered.serviceMeshPolicies.filter(p => includeName(p.metadata.name, names)),
    clusterRbacConfigs: unfiltered.clusterRbacConfigs.filter(rc => includeName(rc.metadata.name, names)),
    rbacConfigs: unfiltered.rbacConfigs.filter(rc => includeName(rc.metadata.name, names)),
    authorizationPolicies: unfiltered.authorizationPolicies.filter(rc => includeName(rc.metadata.name, names)),
    serviceMeshRbacConfigs: unfiltered.serviceMeshRbacConfigs.filter(rc => includeName(rc.metadata.name, names)),
    sidecars: unfiltered.sidecars.filter(sc => includeName(sc.metadata.name, names)),
    serviceRoles: unfiltered.serviceRoles.filter(sr => includeName(sr.metadata.name, names)),
    serviceRoleBindings: unfiltered.serviceRoleBindings.filter(srb => includeName(srb.metadata.name, names)),
    peerAuthentications: unfiltered.peerAuthentications.filter(pa => includeName(pa.metadata.name, names)),
    requestAuthentications: unfiltered.requestAuthentications.filter(ra => includeName(ra.metadata.name, names)),
    workloadEntries: unfiltered.workloadEntries.filter(we => includeName(we.metadata.name, names)),
    envoyFilters: unfiltered.envoyFilters.filter(ef => includeName(ef.metadata.name, names)),
    attributeManifests: unfiltered.attributeManifests.filter(am => includeName(am.metadata.name, names)),
    httpApiSpecs: unfiltered.httpApiSpecs.filter(ha => includeName(ha.metadata.name, names)),
    httpApiSpecBindings: unfiltered.httpApiSpecBindings.filter(hb => includeName(hb.metadata.name, names)),
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
