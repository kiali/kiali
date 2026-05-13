import { delay, http, HttpResponse } from 'msw';
import { getResponseDelay, shouldApiReturnEmpty, shouldApiTimeout } from '../scenarios';
import {
  createMockServiceListItem,
  deploymentGVK,
  generateMockDashboard,
  generateMockMetrics,
  getWorkloadsByNamespace,
  getWorkloadsForNamespaces
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
