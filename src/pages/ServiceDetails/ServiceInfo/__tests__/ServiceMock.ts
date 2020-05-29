import { ServiceDetailsInfo, WorkloadOverview } from '../../../../types/ServiceInfo';
import { VirtualService } from '../../../../types/IstioObjects';

const virtualServices: VirtualService[] = [
  {
    metadata: {
      name: 'reviews-default',
      namespace: 'bookinfo',
      resourceVersion: '1234',
      creationTimestamp: '2018-03-14T10:17:52Z'
    },
    spec: {
      hosts: ['rewiews'],
      gateways: ['reviews'],
      http: [
        {
          route: [
            {
              destination: {
                subset: 'v1',
                host: 'reviews'
              },
              weight: 55
            },
            {
              destination: {
                subset: 'v3',
                host: 'reviews'
              },
              weight: 55
            }
          ]
        }
      ],
      tcp: [
        {
          match: [],
          route: [
            {
              destination: {
                subset: 'v1',
                host: 'reviews'
              },
              weight: 55
            },
            {
              destination: {
                subset: 'v2',
                host: 'reviews'
              },
              weight: 55
            }
          ]
        }
      ]
    }
  }
];

const workloads: WorkloadOverview[] = [
  {
    name: 'reviews-v2',
    type: 'Deployment',
    istioSidecar: true,
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v2' }
  },
  {
    name: 'reviews-v3',
    type: 'Deployment',
    istioSidecar: true,
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v3' }
  },
  {
    name: 'reviews-v1',
    type: 'Deployment',
    istioSidecar: true,
    resourceVersion: '081020181987',
    createdAt: '2018-03-14T10:17:52Z"',
    labels: { app: 'reviews', version: 'v1' }
  }
];

export const Service: ServiceDetailsInfo = {
  service: {
    name: 'details',
    createdAt: '2019-10-08T08:43:58Z',
    resourceVersion: '22316',
    labels: { app: 'details', service: 'details' },
    selectors: { app: 'details' },
    type: 'ClusterIP',
    ip: '172.30.118.205',
    ports: [{ name: 'http', protocol: 'TCP', port: 9080 }],
    externalName: ''
  },
  istioSidecar: true,
  virtualServices: { items: virtualServices, permissions: { create: true, update: true, delete: true } },
  workloads: workloads,
  destinationRules: { items: [], permissions: { create: true, update: true, delete: true } },
  validations: {},
  additionalDetails: []
};

describe('#Mock Service', () => {
  it('Mock Service', () => {
    expect(typeof Service).toBe('object');
  });
});
