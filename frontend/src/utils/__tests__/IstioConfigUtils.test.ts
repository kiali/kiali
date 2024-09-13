import { getIstioObjectGVK, isServerHostValid, isValidUrl, mergeJsonPatch } from '../IstioConfigUtils';
import { IstioObject } from '../../types/IstioObjects';
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
    const istioObj: IstioObject = { metadata: {} as any };
    const result = getIstioObjectGVK(istioObj);
    expect(result).toEqual({ group: '', version: '', kind: '' });
  });

  it('Correct values', () => {
    const istioObj: IstioObject = {
      apiVersion: 'networking.istio.io/v1',
      kind: 'VirtualService',
      metadata: {} as any
    };
    const result = getIstioObjectGVK(istioObj);
    expect(result).toEqual({ group: 'networking.istio.io', version: 'v1', kind: 'VirtualService' });
  });

  it('Invalid apiVersion, valid Kind', () => {
    const istioObj: IstioObject = {
      apiVersion: 'invalidApiVersion',
      kind: 'AuthorizationPolicy',
      metadata: {} as any
    };
    const result = getIstioObjectGVK(istioObj);
    expect(result).toEqual(dicIstioTypeToGVK['AuthorizationPolicy']);
  });

  it('Empty apiVersion, valid kind', () => {
    const istioObj: IstioObject = {
      kind: 'VirtualService',
      metadata: {} as any
    };
    const result = getIstioObjectGVK(istioObj);
    expect(result).toEqual({ group: '', version: '', kind: '' });
  });

  it('Empty kind, valid apiVersion', () => {
    const istioObj: IstioObject = {
      apiVersion: 'networking.istio.io/v1',
      metadata: {} as any
    };
    const result = getIstioObjectGVK(istioObj);
    expect(result).toEqual({ group: '', version: '', kind: '' });
  });
});
