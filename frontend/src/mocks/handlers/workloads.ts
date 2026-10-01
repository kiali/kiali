import { delay, http, HttpResponse } from 'msw';
import { getResponseDelay, shouldApiReturnEmpty, shouldApiTimeout } from '../scenarios';
import {
  createMockServiceListItem,
  deploymentGVK,
  generateMockDashboard,
  generateMockMetrics,
  getAppsByNamespace,
  getServicesByNamespace,
  getWorkloadsByNamespace,
  getWorkloadsForNamespaces,
  serviceGVK
} from './utils';

export const workloadHandlers = [
  http.get('*/api/clusters/workloads', async ({ request }) => {
    await delay(getResponseDelay());

    if (shouldApiTimeout('workloads')) {
      return HttpResponse.json({ error: 'Request timeout: failed to fetch workloads' }, { status: 504 });
    }

    if (shouldApiReturnEmpty('workloads')) {
      return HttpResponse.json({
        cluster: 'cluster-default',
        workloads: [],
        validations: { workload: {} }
      });
    }

    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const workloads = getWorkloadsForNamespaces(namespaces);

    const workloadValidations: Record<string, Record<string, unknown>> = {
      workload: {}
    };
    workloads.forEach(wl => {
      if (wl.validations) {
        const key = `${wl.name}.${wl.namespace}`;
        workloadValidations.workload[key] = wl.validations;
      }
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      workloads,
      validations: workloadValidations
    });
  }),

  http.get('*/api/namespaces/:namespace/workloads', ({ params }) => {
    const { namespace } = params;
    const workloadsByNamespace = getWorkloadsByNamespace();
    const workloads = workloadsByNamespace[namespace as string] || [];

    const workloadValidations: Record<string, Record<string, unknown>> = {
      workload: {}
    };
    workloads.forEach(wl => {
      if (wl.validations) {
        const key = `${wl.name}.${wl.namespace}`;
        workloadValidations.workload[key] = wl.validations;
      }
    });

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      workloads,
      validations: workloadValidations
    });
  }),

  http.get('*/api/namespaces/:namespace/workloads/:workload', ({ params }) => {
    const { workload, namespace } = params;
    const workloadsByNamespace = getWorkloadsByNamespace();
    const nsWorkloads = workloadsByNamespace[namespace as string] || workloadsByNamespace['bookinfo'];
    const found = nsWorkloads.find(w => w.name === workload);

    if (found) {
      const validationKey = `${workload}.${namespace}`;
      const workloadValidations = {
        workload: {
          [validationKey]: {
            name: workload,
            objectGVK: deploymentGVK,
            valid: true,
            checks: []
          }
        }
      };

      const istioContainers = found.isZtunnel ? [] : [{ name: 'istio-proxy', image: 'docker.io/istio/proxyv2:1.20.0' }];
      const istioInitContainers = found.isZtunnel
        ? []
        : [{ name: 'istio-init', image: 'docker.io/istio/proxyv2:1.20.0' }];
      const runtimes = found.isZtunnel
        ? []
        : [{ name: 'envoy', dashboardRefs: [{ template: 'envoy', title: 'Envoy Metrics' }] }];

      return HttpResponse.json({
        ...found,
        createdAt: new Date().toISOString(),
        resourceVersion: '12345',
        type: found.isZtunnel ? 'DaemonSet' : 'Deployment',
        istioInjectionAnnotation: !found.isZtunnel,
        podCount: found.isZtunnel ? 3 : 1,
        annotations: {},
        healthAnnotations: {},
        additionalDetails: [],
        serviceAccountNames: [`${found.labels.app}-service-account`],
        pods: [
          {
            name: `${workload}-abc123`,
            labels: found.labels,
            createdAt: new Date().toISOString(),
            createdBy: [{ name: workload as string, kind: found.isZtunnel ? 'DaemonSet' : 'Deployment' }],
            istioContainers,
            istioInitContainers,
            status: 'Running',
            statusMessage: '',
            statusReason: '',
            appLabel: true,
            versionLabel: true,
            containers: [{ name: found.labels.app, image: `${found.labels.app}:1.0` }],
            serviceAccountName: `${found.labels.app}-service-account`
          }
        ],
        services: [createMockServiceListItem(found.labels.app, namespace as string)],
        runtimes,
        validations: workloadValidations,
        waypointServices: found.isWaypoint
          ? [
              { name: 'productpage', namespace: 'bookinfo' },
              { name: 'reviews', namespace: 'bookinfo' },
              { name: 'ratings', namespace: 'bookinfo' },
              { name: 'details', namespace: 'bookinfo' }
            ]
          : [],
        waypointWorkloads: found.isWaypoint
          ? [
              { name: 'reviews-v1', namespace: 'bookinfo' },
              { name: 'ratings-v1', namespace: 'bookinfo' },
              { name: 'productpage-v1', namespace: 'bookinfo' }
            ]
          : []
      });
    }

    return HttpResponse.json({ error: 'Workload not found' }, { status: 404 });
  }),

  // Namespace services
  http.get('*/api/namespaces/:namespace/services', ({ params }) => {
    const { namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const services = servicesByNamespace[namespace as string] || [];

    // Build validations map
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

  // Service detail
  http.get('*/api/namespaces/:namespace/services/:service', ({ params }) => {
    const { service, namespace } = params;
    const servicesByNamespace = getServicesByNamespace();
    const nsServices = servicesByNamespace[namespace as string] || servicesByNamespace['bookinfo'];
    const found = nsServices.find(s => s.name === service);

    if (found) {
      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads
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

      return HttpResponse.json({
        service: {
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
        },
        endpoints: [
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
        serviceEntries: [],
        istioSidecar: true,
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

  // Namespace apps
  http.get('*/api/namespaces/:namespace/apps', ({ params }) => {
    const { namespace } = params;
    const appsByNamespace = getAppsByNamespace();
    const applications = appsByNamespace[namespace as string] || [];

    return HttpResponse.json({
      cluster: 'cluster-default',
      namespace,
      applications
    });
  }),

  // App detail
  http.get('*/api/namespaces/:namespace/apps/:app', ({ params }) => {
    const { app, namespace } = params;
    const appsByNamespace = getAppsByNamespace();
    const nsApps = appsByNamespace[namespace as string] || appsByNamespace['bookinfo'];
    const found = nsApps.find(a => a.name === app);

    if (found) {
      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads.filter(w => w.labels.app === app);

      // Transform workloads to AppWorkload format
      const appWorkloads = relatedWorkloads.map(w => ({
        workloadName: w.name,
        gvk: w.gvk,
        isAmbient: w.isAmbient,
        isGateway: w.isGateway,
        isWaypoint: w.isWaypoint,
        isZtunnel: w.isZtunnel,
        istioSidecar: w.istioSidecar,
        labels: w.labels,
        namespace: w.namespace,
        serviceAccountNames: [`${w.labels.app}-service-account`]
      }));

      return HttpResponse.json({
        name: found.name,
        cluster: found.cluster,
        instanceType: found.instanceType,
        isAmbient: found.isAmbient,
        health: found.health,
        namespace: { name: namespace, cluster: 'cluster-default' },
        workloads: appWorkloads,
        serviceNames: [{ name: app }],
        runtimes: []
      });
    }

    return HttpResponse.json({ error: 'App not found' }, { status: 404 });
  }),

  http.get('*/api/namespaces/:namespace/workloads/:workload/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/workloads/:workload/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('Workload', direction));
  })
];
