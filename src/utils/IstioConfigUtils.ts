import { IstioConfigDetails } from '../types/IstioConfigDetails';
import { IstioObject } from '../types/IstioObjects';
import _ from 'lodash';

export const mergeJsonPatch = (objectModified: object, object?: object): object => {
  if (!object) {
    return objectModified;
  }
  const customizer = (objValue, srcValue) => {
    if (!objValue) {
      return null;
    }
    if (_.isObject(objValue) && _.isObject(srcValue)) {
      _.mergeWith(objValue, srcValue, customizer);
    }
    return objValue;
  };
  _.mergeWith(objectModified, object, customizer);
  return objectModified;
};

export const getIstioObject = (istioObjectDetails?: IstioConfigDetails) => {
  let istioObject: IstioObject | undefined;
  if (istioObjectDetails) {
    if (istioObjectDetails.gateway) {
      istioObject = istioObjectDetails.gateway;
    } else if (istioObjectDetails.virtualService) {
      istioObject = istioObjectDetails.virtualService;
    } else if (istioObjectDetails.destinationRule) {
      istioObject = istioObjectDetails.destinationRule;
    } else if (istioObjectDetails.serviceEntry) {
      istioObject = istioObjectDetails.serviceEntry;
    } else if (istioObjectDetails.rule) {
      istioObject = istioObjectDetails.rule;
    } else if (istioObjectDetails.adapter) {
      istioObject = istioObjectDetails.adapter;
    } else if (istioObjectDetails.template) {
      istioObject = istioObjectDetails.template;
    } else if (istioObjectDetails.quotaSpec) {
      istioObject = istioObjectDetails.quotaSpec;
    } else if (istioObjectDetails.quotaSpecBinding) {
      istioObject = istioObjectDetails.quotaSpecBinding;
    } else if (istioObjectDetails.policy) {
      istioObject = istioObjectDetails.policy;
    } else if (istioObjectDetails.meshPolicy) {
      istioObject = istioObjectDetails.meshPolicy;
    } else if (istioObjectDetails.serviceMeshPolicy) {
      istioObject = istioObjectDetails.serviceMeshPolicy;
    } else if (istioObjectDetails.clusterRbacConfig) {
      istioObject = istioObjectDetails.clusterRbacConfig;
    } else if (istioObjectDetails.rbacConfig) {
      istioObject = istioObjectDetails.rbacConfig;
    } else if (istioObjectDetails.authorizationPolicy) {
      istioObject = istioObjectDetails.authorizationPolicy;
    } else if (istioObjectDetails.serviceMeshRbacConfig) {
      istioObject = istioObjectDetails.serviceMeshRbacConfig;
    } else if (istioObjectDetails.serviceRole) {
      istioObject = istioObjectDetails.serviceRole;
    } else if (istioObjectDetails.serviceRoleBinding) {
      istioObject = istioObjectDetails.serviceRoleBinding;
    } else if (istioObjectDetails.sidecar) {
      istioObject = istioObjectDetails.sidecar;
    }
  }
  return istioObject;
};

const nsRegexp = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;
const hostRegexp = /(?=^.{4,253}$)(^((?!-)(([a-zA-Z0-9-]{0,62}[a-zA-Z0-9])|\*)\.)+[a-zA-Z]{2,63}$)/;

// Used to check if Sidecar and Gateway host expressions are valid
export const isServerHostValid = (serverHost: string): boolean => {
  if (serverHost.length === 0) {
    return false;
  }
  // <namespace>/<host>
  const parts = serverHost.split('/');
  // More than one /
  if (parts.length > 2) {
    return false;
  }
  // parts[0] is a dns
  let dnsValid = true;
  let hostValid = true;
  let dns = '';
  let host = '';
  if (parts.length === 2) {
    dns = parts[0];
    host = parts[1];

    if (dns !== '.' && dns !== '*') {
      dnsValid = parts[0].search(nsRegexp) === 0;
    }
  } else {
    host = parts[0];
  }

  if (host !== '*') {
    hostValid = host.search(hostRegexp) === 0;
  }
  return dnsValid && hostValid;
};
