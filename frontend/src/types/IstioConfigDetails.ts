import { Namespace } from './Namespace';
import { ResourcePermissions } from './Permissions';
import {
  AuthorizationPolicy,
  DestinationRule,
  Gateway,
  K8sGateway,
  K8sHTTPRoute,
  K8sReferenceGrant,
  ServiceEntry,
  VirtualService,
  ObjectValidation,
  Sidecar,
  IstioObject,
  PeerAuthentication,
  RequestAuthentication,
  WorkloadEntry,
  EnvoyFilter,
  WorkloadGroup,
  References,
  HelpMessage,
  WasmPlugin,
  Telemetry
} from './IstioObjects';
import { AceOptions } from 'react-ace/types';

export interface IstioConfigId {
  namespace: string;
  object: string;
  objectType: string;
}

export interface IstioConfigDetails {
  authorizationPolicy: AuthorizationPolicy;
  cluster?: string;
  destinationRule: DestinationRule;
  envoyFilter: EnvoyFilter;
  gateway: Gateway;
  help?: HelpMessage[];
  k8sGateway: K8sGateway;
  k8sHTTPRoute: K8sHTTPRoute;
  k8sReferenceGrant: K8sReferenceGrant;
  namespace: Namespace;
  peerAuthentication: PeerAuthentication;
  permissions: ResourcePermissions;
  references?: References;
  requestAuthentication: RequestAuthentication;
  serviceEntry: ServiceEntry;
  sidecar: Sidecar;
  telemetry: Telemetry;
  validation: ObjectValidation;
  virtualService: VirtualService;
  wasmPlugin: WasmPlugin;
  workloadEntry: WorkloadEntry;
  workloadGroup: WorkloadGroup;
}

export interface IstioConfigDetailsQuery {
  help?: boolean;
  validate?: boolean;
}

export const aceOptions: AceOptions = {
  autoScrollEditorIntoView: true,
  showPrintMargin: false
};

export const safeDumpOptions = {
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

export interface ParsedSearch {
  name?: string;
  type?: string;
}

export interface IstioPermissions {
  [namespace: string]: {
    [type: string]: ResourcePermissions;
  };
}

export interface IstioPermissionsQuery {
  namespaces: string;
}

// Helper function to compare two IstioConfigDetails iterating over its IstioObject children.
// When an IstioObject child has changed (resourceVersion is different) it will return a tuple with
//  boolean: true if resourceVersion has changed in newer version
//  string: IstioObject child
//  string: resourceVersion of newer version
export const compareResourceVersion = (
  oldIstioConfigDetails: IstioConfigDetails,
  newIstioConfigDetails: IstioConfigDetails
): [boolean, string, string] => {
  const keys = Object.keys(oldIstioConfigDetails);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const oldIstioObject = oldIstioConfigDetails[key] as IstioObject;
    const newIstioObject = newIstioConfigDetails[key] as IstioObject;

    if (
      oldIstioObject &&
      newIstioObject &&
      oldIstioObject.metadata &&
      newIstioObject.metadata &&
      oldIstioObject.metadata.resourceVersion &&
      newIstioObject.metadata.resourceVersion &&
      oldIstioObject.metadata.resourceVersion !== newIstioObject.metadata.resourceVersion
    ) {
      return [true, key, newIstioObject.metadata.resourceVersion];
    }
  }

  return [false, '', ''];
};
