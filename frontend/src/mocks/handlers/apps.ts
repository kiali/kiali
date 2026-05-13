import { delay, http, HttpResponse } from 'msw';
import { getResponseDelay, shouldApiReturnEmpty, shouldApiTimeout } from '../scenarios';
import {
  generateMockDashboard,
  generateMockMetrics,
  getAppsByNamespace,
  getAppsForNamespaces,
  getWorkloadsByNamespace
} from './utils';

export const appHandlers = [
  http.get('*/api/clusters/apps', async ({ request }) => {
    await delay(getResponseDelay());

    if (shouldApiTimeout('applications')) {
      return HttpResponse.json({ error: 'Request timeout: failed to fetch applications' }, { status: 504 });
    }

    if (shouldApiReturnEmpty('applications')) {
      return HttpResponse.json({
        cluster: 'cluster-default',
        applications: []
      });
    }

    const url = new URL(request.url);
    const namespaces = url.searchParams.get('namespaces') || 'bookinfo';
    const applications = getAppsForNamespaces(namespaces);

    return HttpResponse.json({
      cluster: 'cluster-default',
      applications
    });
  }),

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

  http.get('*/api/namespaces/:namespace/apps/:app', ({ params }) => {
    const { app, namespace } = params;
    const appsByNamespace = getAppsByNamespace();
    const nsApps = appsByNamespace[namespace as string] || appsByNamespace['bookinfo'];
    const found = nsApps.find(a => a.name === app);

    if (found) {
      const workloadsByNamespace = getWorkloadsByNamespace();
      const nsWorkloads = workloadsByNamespace[namespace as string] || [];
      const relatedWorkloads = nsWorkloads.filter(w => w.labels.app === app);

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
        serviceNames: [app],
        runtimes: []
      });
    }

    return HttpResponse.json({ error: 'App not found' }, { status: 404 });
  }),

  http.get('*/api/namespaces/:namespace/apps/:app/metrics', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockMetrics(direction));
  }),

  http.get('*/api/namespaces/:namespace/apps/:app/dashboard', ({ request }) => {
    const url = new URL(request.url);
    const direction = url.searchParams.get('direction') || 'inbound';
    return HttpResponse.json(generateMockDashboard('App', direction));
  })
];
