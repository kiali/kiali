import Namespace from './Namespace';
import { AceOptions } from 'react-ace';
import { ResourcePermissions } from './Permissions';
import {
  AuthorizationPolicy,
  DestinationRule,
  Gateway,
  IstioAdapter,
  IstioRule,
  IstioTemplate,
  Policy,
  QuotaSpec,
  QuotaSpecBinding,
  ServiceEntry,
  VirtualService,
  ObjectValidation,
  RbacConfig,
  ServiceRole,
  ServiceRoleBinding,
  ClusterRbacConfig,
  Sidecar,
  ServiceMeshRbacConfig
} from './IstioObjects';

export interface IstioConfigId {
  namespace: string;
  objectType: string;
  objectSubtype: string;
  object: string;
}

export interface IstioConfigDetails {
  namespace: Namespace;
  gateway: Gateway;
  virtualService: VirtualService;
  destinationRule: DestinationRule;
  serviceEntry: ServiceEntry;
  sidecar: Sidecar;
  rule: IstioRule;
  adapter: IstioAdapter;
  template: IstioTemplate;
  quotaSpec: QuotaSpec;
  quotaSpecBinding: QuotaSpecBinding;
  policy: Policy;
  meshPolicy: Policy;
  serviceMeshPolicy: Policy;
  clusterRbacConfig: ClusterRbacConfig;
  rbacConfig: RbacConfig;
  authorizationPolicy: AuthorizationPolicy;
  serviceMeshRbacConfig: ServiceMeshRbacConfig;
  serviceRole: ServiceRole;
  serviceRoleBinding: ServiceRoleBinding;
  permissions: ResourcePermissions;
  validation: ObjectValidation;
}

export const aceOptions: AceOptions = {
  showPrintMargin: false,
  autoScrollEditorIntoView: true
};

export const safeDumpOptions = {
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

export interface ParsedSearch {
  type?: string;
  name?: string;
}

export interface IstioPermissions {
  [namespace: string]: {
    [type: string]: ResourcePermissions;
  };
}
