import { ServiceDetailsInfo } from '../../types/ServiceInfo';

export const SERVICE_DETAILS: ServiceDetailsInfo = {
  service: {
    name: 'reviews',
    createdAt: '2018-06-29T16:43:18+02:00',
    type: 'ClusterIP',
    externalName: 'my.database.example.com',
    labels: {
      app: 'reviews'
    },
    ip: '172.30.196.248',
    ports: [
      {
        name: 'http',
        protocol: 'TCP',
        port: 9080
      }
    ],
    resourceVersion: '2652'
  },
  istioSidecar: true,
  endpoints: [
    {
      addresses: [
        {
          kind: 'Pod',
          name: 'reviews-v3-5f5bcb6765-hj46f',
          ip: '172.17.0.20'
        },
        {
          kind: 'Pod',
          name: 'reviews-v2-d896b68c-jnxgm',
          ip: '172.17.0.21'
        },
        {
          kind: 'Pod',
          name: 'reviews-v1-5d6696bcf7-2sls7',
          ip: '172.17.0.22'
        }
      ],
      ports: [
        {
          name: 'http',
          protocol: 'TCP',
          port: 9080
        }
      ]
    }
  ],
  virtualServices: {
    items: [
      {
        metadata: {
          name: 'reviews',
          creationTimestamp: '2018-07-02T13:44:01+02:00',
          resourceVersion: '393057'
        },
        spec: {
          hosts: ['reviews'],
          gateways: undefined,
          http: [
            {
              route: [
                {
                  destination: {
                    host: 'reviews',
                    subset: 'v1'
                  }
                }
              ]
            }
          ],
          tcp: undefined
        }
      }
    ],
    permissions: {
      update: false,
      delete: false,
      create: false
    }
  },
  destinationRules: {
    items: [
      {
        metadata: {
          name: 'reviews',
          creationTimestamp: '2018-07-02T13:44:01+02:00',
          resourceVersion: '393061'
        },
        spec: {
          host: 'reviews',
          trafficPolicy: undefined,
          subsets: [
            {
              labels: {
                version: 'v1'
              },
              name: 'v1'
            },
            {
              labels: {
                version: 'v2'
              },
              name: 'v2'
            },
            {
              labels: {
                version: 'v3'
              },
              name: 'v3'
            }
          ]
        }
      }
    ],
    permissions: {
      update: false,
      delete: false,
      create: false
    }
  },
  workloads: [],
  health: undefined,
  validations: {
    destinationrule: {
      reviews: {
        name: 'details',
        objectType: 'destinationrule',
        valid: false,
        checks: [
          {
            message: 'This subset is not found from the host',
            severity: 'error',
            path: 'spec/subsets[0]/version'
          },
          {
            message: 'This subset is not found from the host',
            severity: 'error',
            path: 'spec/subsets[1]/version'
          }
        ]
      }
    }
  }
};
