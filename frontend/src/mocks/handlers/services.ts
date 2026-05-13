import { http, HttpResponse } from 'msw';
import {
  generateMockDashboard,
  generateMockMetrics,
  getServicesByNamespace,
  getServicesForNamespaces,
  getWorkloadsByNamespace,
  serviceGVK
} from './utils';

export const serviceHandlers = [
  http.get('*/api/clusters/services', ({ request }) => {
    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const services = getServicesForNamespaces(namespaces);

    const serviceValidations: Record<string, Record<string, unknown>> = {
      service: {}
    };
    services.forEach(svc => {
      const key = `${svc.name}.${svc.namespace}`;
      serviceValidations.service[key] = {
        name: svc.name,
        objectGVK: serviceGVK,
        valid: true,
        checks: []
      };
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      services,
      validations: serviceValidations
    });
  }),

  http.get('*/api/namespaces/:namespace/services', ({ params }) => {
    const { namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const services = servicesByNamespace[namespace as string] || [];

    const serviceValidations: Record<string, Record<string, unknown>> = {
      service: {}
    };
    services.forEach(svc => {
      const key = `${svc.name}.${svc.namespace}`;
      serviceValidations.service[key] = {
        name: svc.name,
        objectGVK: serviceGVK,
        valid: svc.validation.valid,
        checks: svc.validation.checks
      };
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      services,
      validations: serviceValidations
    });
  }),

  http.get('*/api/namespaces/:namespace/services/:service', ({ params }) => {
    const { service, namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const nsServices = servicesByNamespace[namespace as string] || servicesByNamespace['bookinfo'];
    const found = nsServices.find(s => s.name === service);

    if (found) {
      const isExternal = found.serviceRegistry === 'External';

      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = isExternal
        ? []
        : nsWorkloads
            .filter(w => w.labels.app === service)
            .map(w => ({
              name: w.name,
              namespace: namespace as string,
              createdAt: new Date().toISOString(),
              resourceVersion: '12345',
              type: 'Deployment',
              istioSidecar: true,
              isAmbient: false,
              isGateway: false,
              isWaypoint: false,
              isZtunnel: false,
              labels: w.labels,
              serviceAccountNames: [`${w.labels.app}-service-account`]
            }));

      const serviceDetail = isExternal
        ? {
            name: service,
            namespace: namespace,
            cluster: 'cluster-default',
            createdAt: new Date().toISOString(),
            resourceVersion: '12345',
            type: 'ExternalName',
            ip: '',
            externalName: service as string,
            labels: {},
            selectors: {},
            ports: [
              {
                name: 'https',
                port: 443,
                protocol: 'TCP',
                appProtocol: 'https',
                istioProtocol: 'https',
                tlsMode: 'disabled'
              }
            ],
            annotations: {},
            additionalDetails: []
          }
        : {
            name: service,
            namespace: namespace,
            cluster: 'cluster-default',
            createdAt: new Date().toISOString(),
            resourceVersion: '12345',
            type: 'ClusterIP',
            ip: '10.96.0.10',
            externalName: '',
            labels: { app: service },
            selectors: { app: service },
            ports: [
              {
                name: 'http',
                port: 9080,
                protocol: 'TCP',
                appProtocol: 'http',
                istioProtocol: 'http',
                tlsMode: 'istio'
              }
            ],
            annotations: {},
            additionalDetails: []
          };

      const serviceEntries = isExternal
        ? [
            {
              metadata: {
                name: `${service}-entry`,
                namespace: namespace,
                createdTimestamp: new Date().toISOString(),
                resourceVersion: '12345'
              },
              spec: {
                hosts: [service as string],
                location: 'MESH_EXTERNAL',
                ports: [{ name: 'https', number: 443, protocol: 'TLS' }],
                resolution: 'DNS'
              }
            }
          ]
        : [];

      return HttpResponse.json({
        service: serviceDetail,
        endpoints: isExternal
          ? []
          : [
              {
                addresses: [
                  {
                    ip: '10.244.0.10',
                    kind: 'Pod',
                    name: `${service}-v1-abc123`,
                    istioProtocol: 'http',
                    tlsMode: 'istio'
                  }
                ],
                ports: [
                  {
                    name: 'http',
                    port: 9080,
                    protocol: 'TCP',
                    appProtocol: 'http',
                    istioProtocol: 'http',
                    tlsMode: 'istio'
                  }
                ]
              }
            ],
        workloads: relatedWorkloads,
        virtualServices: [],
        destinationRules: [],
        k8sHTTPRoutes: [],
        k8sGRPCRoutes: [],
        k8sInferencePools: [],
        serviceEntries,
        istioSidecar: !isExternal,
        isAmbient: false,
        istioPermissions: {
          create: true,
          update: true,
          delete: true
        },
        namespaceMTLS: {
          status: 'ENABLED',
          autoMTLSEnabled: true,
          minTLS: 'N/A'
        },
        validations: {
          [service as string]: {
            name: service,
            objectType: 'service',
            valid: true,
            checks: []
          }
        },
        health: {
          requests: {
            inbound: { http: { '200': 100 } },
            outbound: { http: { '200': 100 } },
            healthAnnotations: {}
          }
        }
      });
    }

    return HttpResponse.json({ error: 'Service not found' }, { status: 404 });
  }),

  http.get('*/api/namespaces/:namespace/services/:service/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/services/:service/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Service', direction));
  })
];
