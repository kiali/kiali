import {
  getGVKTypeString,
  getIstioObjectGVK,
  isServerHostValid,
  istioTypesToGVKString,
  isValidUrl,
  kindToStringIncludeK8s,
  mergeJsonPatch,
  stringToGVK
} from '../IstioConfigUtils';
import { dicTypeToGVK, gvkType } from '../../types/IstioConfigList';

describe('Validate JSON Patchs', () => {
  const gateway: object = {
    kind: 'Gateway',
    namespace: {
      name: 'bookinfo'
    },
    spec: {
      selector: {
        istio: 'ingressgateway'
      },
      servers: [
        {
          port: {
            number: 80,
            name: 'http',
            protocol: 'HTTP'
          },
          hosts: ['*']
        }
      ]
    }
  };

  const gatewayModified: object = {
    apiVersion: 'networking.istio.io/v1',
    kind: 'Gateway',
    spec: {
      selector: {
        app: 'myapp'
      },
      servers: [
        {
          port: {
            number: 80,
            name: 'http',
            protocol: 'HTTP'
          },
          hosts: ['*']
        }
      ]
    }
  };

  it('Basic Test', () => {
    mergeJsonPatch(gatewayModified, gateway);

    // tslint:disable-next-line
    expect(gatewayModified['namespace']).toBeNull();

    // tslint:disable-next-line
    expect(gatewayModified['spec']['selector']['istio']).toBeNull();
  });
});

describe('Validate Gateway/Sidecar Server Host ', () => {
  it('No Namespace prefix', () => {
    expect(isServerHostValid('*', false)).toBeTruthy();
    expect(isServerHostValid('*', true)).toBeFalsy();
    expect(isServerHostValid('productpage', false)).toBeFalsy();
    expect(isServerHostValid('productpage.example.com', false)).toBeTruthy();
    expect(isServerHostValid('*.example.com', false)).toBeTruthy();
  });

  it('Namespace prefix', () => {
    expect(isServerHostValid('bookinfo/*', true)).toBeTruthy();
    expect(isServerHostValid('*/*', true)).toBeTruthy();
    expect(isServerHostValid('./*', true)).toBeTruthy();
    expect(isServerHostValid('bookinfo/productpage', true)).toBeFalsy();
    expect(isServerHostValid('*/productpage', true)).toBeFalsy();
    expect(isServerHostValid('./productpage', true)).toBeFalsy();
    expect(isServerHostValid('bookinfo/productpage.example.com', true)).toBeTruthy();
    expect(isServerHostValid('*/productpage.example.com', true)).toBeTruthy();
    expect(isServerHostValid('./productpage.example.com', true)).toBeTruthy();
    expect(isServerHostValid('bookinfo/*.example.com', true)).toBeTruthy();
    expect(isServerHostValid('*/*.example.com', true)).toBeTruthy();
    expect(isServerHostValid('./*.example.com', true)).toBeTruthy();
  });

  it('Catch bad urls', () => {
    expect(isServerHostValid('bookinfo//reviews', true)).toBeFalsy();
    expect(isServerHostValid('bookinf*/reviews', true)).toBeFalsy();
  });
});

describe('Validate bad urls', () => {
  it('Good urls', () => {
    expect(isValidUrl('http://www.googleapis.com/oauth2/v1/certs')).toBeTruthy();
    expect(isValidUrl('https://www.googleapis.com/oauth2/v1/certs')).toBeTruthy();
  });

  it('Bad urls', () => {
    expect(isValidUrl('ramdom')).toBeFalsy();
    expect(isValidUrl('123test')).toBeFalsy();
  });
});

describe('Validate returned GoupVersionKind for IstioObject', () => {
  it('Missing apiVersion and kind', () => {
    const result = getIstioObjectGVK();
    expect(result).toEqual({ Group: '', Version: '', Kind: '' });
  });

  it('Correct values', () => {
    const result = getIstioObjectGVK('networking.istio.io/v1', 'VirtualService');
    expect(result).toEqual({ Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' });
  });

  it('Invalid apiVersion, valid Kind', () => {
    const result = getIstioObjectGVK('invalidApiVersion', 'AuthorizationPolicy');
    expect(result).toEqual(dicTypeToGVK[gvkType.AuthorizationPolicy]);
  });

  it('Empty apiVersion, valid kind', () => {
    const result = getIstioObjectGVK('', 'VirtualService');
    expect(result).toEqual({ Group: '', Version: '', Kind: '' });
  });

  it('Empty kind, valid apiVersion', () => {
    const result = getIstioObjectGVK('networking.istio.io/v1');
    expect(result).toEqual({ Group: '', Version: '', Kind: '' });
  });
});

describe('Validate converting GroupVersionKind To String', () => {
  it('Correct GroupVersionKind properties', () => {
    const result = getGVKTypeString({ Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' });
    expect(result).toBe('networking.istio.io/v1, Kind=VirtualService');
  });

  it('Correct Workload GroupVersionKind properties', () => {
    const result = getGVKTypeString({ Group: 'apps', Version: 'v1', Kind: 'Deployment' });
    expect(result).toBe('apps/v1, Kind=Deployment');
  });

  it('Correct Workload Kind properties', () => {
    const result = getGVKTypeString(gvkType.Deployment);
    expect(result).toBe('apps/v1, Kind=Deployment');
  });

  it('Correct Gateway Kind properties', () => {
    const result = getGVKTypeString(gvkType.Gateway);
    expect(result).toBe('networking.istio.io/v1, Kind=Gateway');
  });

  it('Validate empty string when Group, Version, and Kind are all empty', () => {
    const result = getGVKTypeString({ Group: '', Version: '', Kind: '' });
    expect(result).toBe('');
  });

  it('Validate that result is Kind if Group or Version are empty', () => {
    const gvkMissingGroup = { Group: '', Version: 'v1', Kind: 'ServiceEntry' };
    const gvkMissingVersion = { Group: 'networking.istio.io', Version: '', Kind: 'ServiceEntry' };

    expect(getGVKTypeString(gvkMissingGroup)).toBe('ServiceEntry');
    expect(getGVKTypeString(gvkMissingVersion)).toBe('ServiceEntry');
  });

  it('Validate it returns Kind if both Group and Version are empty', () => {
    const result = getGVKTypeString({ Group: '', Version: '', Kind: 'Gateway' });
    expect(result).toBe('Gateway');
  });
});

describe('Validate converting String To GroupVersionKind', () => {
  it('Validate the correct GVK string', () => {
    const gvk = 'networking.istio.io/v1,VirtualService';
    const result = stringToGVK(gvk);
    expect(result).toEqual({ Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' });
  });

  it('Validate the Kind only for Workloads', () => {
    const gvk = 'workloads';
    const result = stringToGVK(gvk);
    expect(result).toEqual({ Group: '', Version: '', Kind: 'workloads' });
  });

  it('Check invalid group/version format, Kind is returned only', () => {
    const gvk = 'invalidFormat,VirtualService';
    const result = stringToGVK(gvk);
    expect(result).toEqual({ Group: '', Version: '', Kind: 'VirtualService' });
  });
});

describe('Validate Kind To String considering api for K8s', () => {
  it('return an empty string if kind is undefined', () => {
    const result = kindToStringIncludeK8s('networking.istio.io/v1', undefined);
    expect(result).toBe('');
  });

  it('return the kind unchanged if apiVersion is undefined', () => {
    const result = kindToStringIncludeK8s(undefined, 'VirtualService');
    expect(result).toBe('VirtualService');
  });

  it('return the kind unchanged if apiVersion does not include "k8s"', () => {
    const result = kindToStringIncludeK8s('networking.istio.io/v1', 'VirtualService');
    expect(result).toBe('VirtualService');
  });

  it('return "K8s" prefixed to the kind if apiVersion includes "k8s"', () => {
    const result = kindToStringIncludeK8s('k8s.networking.io/v1', 'Gateway');
    expect(result).toBe('K8sGateway');
  });

  it('both apiVersion and kind are undefined', () => {
    const result = kindToStringIncludeK8s(undefined, undefined);
    expect(result).toBe('');
  });
});

describe('Validate Istio Types array To GVK Strings array', () => {
  it('Valid scenario', () => {
    const istioTypes = ['AuthorizationPolicy', 'PeerAuthentication', 'K8sGateway', 'Gateway'];
    const expectedOutput = [
      'security.istio.io/v1, Kind=AuthorizationPolicy',
      'security.istio.io/v1, Kind=PeerAuthentication',
      'gateway.networking.k8s.io/v1, Kind=Gateway',
      'networking.istio.io/v1, Kind=Gateway'
    ];

    const result = istioTypesToGVKString(istioTypes);
    expect(result).toEqual(expectedOutput);
  });

  it('Empty strings', () => {
    const istioTypes: string[] = [];
    const result = istioTypesToGVKString(istioTypes);
    expect(result).toEqual([]);
  });

  it('Invalid type', () => {
    const istioTypes = ['InvalidType'];
    const result = istioTypesToGVKString(istioTypes);
    expect(result).toEqual(['']);
  });
});
