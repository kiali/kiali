import Namespace from './Namespace';
import {
  AuthorizationPolicy,
  ClusterRbacConfig,
  DestinationRule,
  DestinationRules,
  Gateway,
  IstioAdapter,
  IstioRule,
  IstioTemplate,
  ObjectValidation,
  PeerAuthentication,
  Policy,
  QuotaSpec,
  QuotaSpecBinding,
  RbacConfig,
  ServiceEntry,
  ServiceMeshRbacConfig,
  ServiceRole,
  ServiceRoleBinding,
  Sidecar,
  Validations,
  VirtualService,
  VirtualServices
} from './IstioObjects';
import { ResourcePermissions } from './Permissions';

export interface IstioConfigItem {
  namespace: string;
  type: string;
  name: string;
  gateway?: Gateway;
  virtualService?: VirtualService;
  destinationRule?: DestinationRule;
  serviceEntry?: ServiceEntry;
  rule?: IstioRule;
  adapter?: IstioAdapter;
  template?: IstioTemplate;
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
  validation?: ObjectValidation;
}

export interface IstioConfigList {
  namespace: Namespace;
  gateways: Gateway[];
  virtualServices: VirtualServices;
  destinationRules: DestinationRules;
  serviceEntries: ServiceEntry[];
  rules: IstioRule[];
  adapters: IstioAdapter[];
  templates: IstioTemplate[];
  quotaSpecs: QuotaSpec[];
  quotaSpecBindings: QuotaSpecBinding[];
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
  gateways: 'Gateway',
  virtualservices: 'VirtualService',
  destinationrules: 'DestinationRule',
  serviceentries: 'ServiceEntry',
  rules: 'Rule',
  adapters: 'Adapter',
  templates: 'Template',
  quotaspecs: 'QuotaSpec',
  quotaspecbindings: 'QuotaSpecBinding',
  instance: 'Instance',
  handler: 'Handler',
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
  peerauthentications: 'PeerAuthentication'
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
    peerAuthentications: unfiltered.peerAuthentications.filter(srb => includeName(srb.metadata.name, names)),
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
