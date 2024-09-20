import { getIstioObjectGVK, gvkToString, isServerHostValid, isValidUrl, mergeJsonPatch } from '../IstioConfigUtils';
import { dicIstioTypeToGVK } from '../../types/IstioConfigList';

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
    expect(result).toEqual(dicIstioTypeToGVK['AuthorizationPolicy']);
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
    const result = gvkToString({ Group: 'networking.istio.io', Version: 'v1', Kind: 'VirtualService' });
    expect(result).toBe('networking.istio.io/v1, Kind=VirtualService');
  });

  it('Validate empty string when Group, Version, and Kind are all empty', () => {
    const result = gvkToString({ Group: '', Version: '', Kind: '' });
    expect(result).toBe('');
  });

  it('Validate that result is Kind if Group or Version are empty', () => {
    const gvkMissingGroup = { Group: '', Version: 'v1', Kind: 'ServiceEntry' };
    const gvkMissingVersion = { Group: 'networking.istio.io', Version: '', Kind: 'ServiceEntry' };

    expect(gvkToString(gvkMissingGroup)).toBe('ServiceEntry');
    expect(gvkToString(gvkMissingVersion)).toBe('ServiceEntry');
  });

  it('Validate it returns Kind if both Group and Version are empty', () => {
    const result = gvkToString({ Group: '', Version: '', Kind: 'Gateway' });
    expect(result).toBe('Gateway');
  });
});
