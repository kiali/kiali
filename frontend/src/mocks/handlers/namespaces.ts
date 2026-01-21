import { http, HttpResponse } from 'msw';
import { Namespace } from '../../types/Namespace';
import { getAllNamespaces } from '../scenarios';

// Generate namespaces based on scenario
const generateNamespaces = (): Namespace[] => {
  const namespaces = getAllNamespaces();

  return namespaces.map(ns => {
    let labels: { [key: string]: string } = {};

    if (ns.name !== 'istio-system' && ns.name !== 'kube-system' && ns.name !== 'default') {
      if (ns.isAmbient) {
        labels = { 'istio.io/dataplane-mode': 'ambient' };
      } else {
        labels = { 'istio-injection': 'enabled' };
      }
    }

    return {
      name: ns.name,
      cluster: ns.cluster,
      isAmbient: ns.isAmbient,
      isControlPlane: ns.name === 'istio-system',
      labels
    };
  });
};

const getMockNamespaces = (): Namespace[] => generateNamespaces();

export const namespaceHandlers = [
  // Get all namespaces
  http.get('*/api/namespaces', ({ request }) => {
    const url = new URL(request.url);
    const cluster = url.searchParams.get('clusterName');
    const mockNamespaces = getMockNamespaces();

    let namespaces = mockNamespaces;
    if (cluster) {
      namespaces = mockNamespaces.filter(ns => ns.cluster === cluster);
    }

    return HttpResponse.json(namespaces);
  }),

  // Get namespace info
  http.get('*/api/namespaces/:namespace/info', ({ params }) => {
    const { namespace } = params;
    const mockNamespaces = getMockNamespaces();
    const ns = mockNamespaces.find(n => n.name === namespace);

    if (ns) {
      return HttpResponse.json(ns);
    }

    return HttpResponse.json({ error: `Namespace ${namespace} not found` }, { status: 404 });
  }),

  // Get namespace validations
  http.get('*/api/namespaces/:namespace/validations', () => {
    return HttpResponse.json({
      objectCount: 0,
      checks: []
    });
  }),

  // Get namespace TLS
  http.get('*/api/namespaces/:namespace/tls', () => {
    return HttpResponse.json({
      status: 'ENABLED',
      autoMTLSEnabled: true,
      minTLS: 'TLSv1_2'
    });
  }),

  // Get namespace metrics
  http.get('*/api/namespaces/:namespace/metrics', () => {
    return HttpResponse.json({});
  })
];
