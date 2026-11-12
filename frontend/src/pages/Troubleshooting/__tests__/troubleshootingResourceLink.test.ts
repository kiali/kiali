import type { TroubleshootingSubProblem } from 'types/Chatbot';
import { parseTroubleshootingTarget } from '../partitionTroubleshooting';
import type { TroubleshootingResourceLink } from '../troubleshootingResourceLink';
import { getTroubleshootingResourceLink } from '../troubleshootingResourceLink';

const linkFor = (subProblem: TroubleshootingSubProblem): TroubleshootingResourceLink | undefined =>
  getTroubleshootingResourceLink(subProblem, parseTroubleshootingTarget(subProblem));

describe('getTroubleshootingResourceLink', () => {
  it('returns an Istio object config link', () => {
    expect(
      linkFor({
        id: 'sp-istio',
        impact: 'VirtualService reviews fails validation',
        issue: 'fails validation',
        istioObject: {
          group: 'networking.istio.io',
          kind: 'VirtualService',
          name: 'reviews',
          namespace: 'bookinfo',
          version: 'v1'
        },
        target: 'VirtualService: bookinfo/reviews'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View IstioObject',
      to: '/namespaces/bookinfo/istio/networking.istio.io/v1/VirtualService/reviews'
    });
  });

  it('returns workload, service, application, and namespace links', () => {
    expect(
      linkFor({
        id: 'sp-wl',
        impact: 'Workload is missing a sidecar',
        issue: 'missing sidecar',
        target: 'Workload (ReplicaSet): bookinfo/kiali-traffic-generator'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Workload',
      to: '/namespaces/bookinfo/workloads/kiali-traffic-generator'
    });

    expect(
      linkFor({
        id: 'sp-svc',
        impact: 'Service is failing',
        issue: 'errors',
        target: 'Service: bookinfo/productpage'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Service',
      to: '/namespaces/bookinfo/services/productpage'
    });

    expect(
      linkFor({
        id: 'sp-app',
        impact: 'Application health is degraded',
        issue: 'degraded',
        target: 'Application: bookinfo/reviews'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Application',
      to: '/namespaces/bookinfo/applications/reviews'
    });

    expect(
      linkFor({
        id: 'sp-ns',
        impact: 'Namespace is not healthy',
        issue: 'not healthy',
        target: 'Namespace: bookinfo'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Namespace',
      to: '/namespaces/bookinfo'
    });
  });

  it('returns View Mesh with meshKiali for observability stack targets', () => {
    expect(
      linkFor({
        id: 'sp-prom',
        impact: 'Metrics are unavailable',
        issue: 'unreachable',
        target: 'Prometheus'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Mesh',
      to: '/mesh?meshKiali=true'
    });

    expect(
      linkFor({
        id: 'sp-grafana',
        impact: 'Dashboards are unavailable',
        issue: 'down',
        target: 'Grafana: istio-system/grafana'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Mesh',
      to: '/mesh?meshKiali=true'
    });

    expect(
      linkFor({
        id: 'sp-tempo',
        impact: 'Traces are lagging',
        issue: 'lagging',
        target: 'Tempo'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Mesh',
      to: '/mesh?meshKiali=true'
    });
  });

  it('returns undefined for unsupported targets', () => {
    expect(
      linkFor({
        id: 'sp-net',
        impact: 'Traffic edge is failing',
        issue: 'traffic',
        target: 'productpage → reviews'
      })
    ).toBeUndefined();
  });
});
