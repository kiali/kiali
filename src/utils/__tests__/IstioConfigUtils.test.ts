import { isServerHostValid, mergeJsonPatch } from '../IstioConfigUtils';

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
    apiVersion: 'networking.istio.io/v1alpha3',
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
    expect(isServerHostValid('*')).toBeTruthy();
    expect(isServerHostValid('productpage')).toBeFalsy();
    expect(isServerHostValid('productpage.example.com')).toBeTruthy();
    expect(isServerHostValid('*.example.com')).toBeTruthy();
  });

  it('Namespace prefix', () => {
    expect(isServerHostValid('bookinfo/*')).toBeTruthy();
    expect(isServerHostValid('*/*')).toBeTruthy();
    expect(isServerHostValid('./*')).toBeTruthy();
    expect(isServerHostValid('bookinfo/productpage')).toBeFalsy();
    expect(isServerHostValid('*/productpage')).toBeFalsy();
    expect(isServerHostValid('./productpage')).toBeFalsy();
    expect(isServerHostValid('bookinfo/productpage.example.com')).toBeTruthy();
    expect(isServerHostValid('*/productpage.example.com')).toBeTruthy();
    expect(isServerHostValid('./productpage.example.com')).toBeTruthy();
    expect(isServerHostValid('bookinfo/*.example.com')).toBeTruthy();
    expect(isServerHostValid('*/*.example.com')).toBeTruthy();
    expect(isServerHostValid('./*.example.com')).toBeTruthy();
  });

  it('Catch bad urls', () => {
    expect(isServerHostValid('bookinfo//reviews')).toBeFalsy();
    expect(isServerHostValid('bookinf*/reviews')).toBeFalsy();
  });
});
