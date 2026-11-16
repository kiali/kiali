import type { TroubleshootingIssue, TroubleshootingSubProblem } from 'types/Chatbot';
import { parseTroubleshootingTarget } from '../partitionTroubleshooting';
import type { TroubleshootingResourceLink } from '../troubleshootingResourceLink';
import {
  getTroubleshootingIssueLinks,
  getTroubleshootingResourceLink,
  toOssmcConsoleUrl
} from '../troubleshootingResourceLink';

const time = { duration: 300, refresh: 60000 };

const linkFor = (subProblem: TroubleshootingSubProblem, isOssmc = false): TroubleshootingResourceLink | undefined =>
  getTroubleshootingResourceLink(subProblem, parseTroubleshootingTarget(subProblem), { ...time, isOssmc });

describe('getTroubleshootingResourceLink', () => {
  it('returns an Istio object config link for Kiali and OSSMC', () => {
    const subProblem: TroubleshootingSubProblem = {
      id: 'sp-istio',
      impact: 'Gateway bookinfo-gateway fails validation',
      issue: 'fails validation',
      istioObject: {
        group: 'networking.istio.io',
        kind: 'Gateway',
        name: 'bookinfo-gateway',
        namespace: 'bookinfo',
        version: 'v1'
      },
      target: 'Gateway: bookinfo/bookinfo-gateway'
    };

    expect(linkFor(subProblem)).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View IstioObject',
      to: '/namespaces/bookinfo/istio/networking.istio.io/v1/Gateway/bookinfo-gateway'
    });
    expect(linkFor(subProblem, true)).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View IstioObject',
      to: '/k8s/ns/bookinfo/networking.istio.io~v1~Gateway/bookinfo-gateway/ossmconsole'
    });
  });

  it('returns workload, service, application, namespace, and pod links', () => {
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
      to: '/namespaces/bookinfo/workloads/kiali-traffic-generator?type=ReplicaSet&duration=300&refresh=60000'
    });

    expect(
      linkFor(
        {
          id: 'sp-wl',
          impact: 'Workload is missing a sidecar',
          issue: 'missing sidecar',
          target: 'Workload (Deployment): bookinfo/details-v1'
        },
        true
      )
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Workload',
      to: '/k8s/ns/bookinfo/deployments/details-v1/ossmconsole'
    });

    expect(
      linkFor({
        id: 'sp-svc',
        impact: 'Service is failing',
        issue: 'errors',
        target: 'Service: bookinfo/details'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Service',
      to: '/namespaces/bookinfo/services/details?duration=300&refresh=60000'
    });
    expect(
      linkFor(
        {
          id: 'sp-svc',
          impact: 'Service is failing',
          issue: 'errors',
          target: 'Service: bookinfo/details'
        },
        true
      )
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Service',
      to: '/k8s/ns/bookinfo/services/details/ossmconsole'
    });

    expect(
      linkFor({
        id: 'sp-app',
        impact: 'Application health is degraded',
        issue: 'degraded',
        target: 'Application: bookinfo/details'
      })
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Application',
      to: '/namespaces/bookinfo/applications/details?duration=300&refresh=60000'
    });
    expect(
      linkFor(
        {
          id: 'sp-app',
          impact: 'Application health is degraded',
          issue: 'degraded',
          target: 'Application: bookinfo/details'
        },
        true
      )
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Application',
      to: '/ossmconsole/applications/bookinfo/details?duration=300&refresh=60000'
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
      to: '/namespaces/bookinfo?duration=300&refresh=60000'
    });
    expect(
      linkFor(
        {
          id: 'sp-ns',
          impact: 'Namespace is not healthy',
          issue: 'not healthy',
          target: 'Namespace: bookinfo'
        },
        true
      )
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Namespace',
      to: '/k8s/cluster/projects/bookinfo/ossmconsole'
    });

    expect(
      linkFor(
        {
          id: 'sp-pod',
          impact: 'Pod is crash looping',
          issue: 'CrashLoopBackOff',
          target: 'Pod: bookinfo/reviews-v2-pod'
        },
        true
      )
    ).toEqual({
      dataTest: 'ai-troubleshooting-view-resource',
      label: 'View Pod',
      to: '/k8s/ns/bookinfo/pods/reviews-v2-pod/ossmconsole'
    });
  });

  it('does not put View Mesh on observability stack children', () => {
    expect(
      linkFor({
        id: 'sp-prom',
        impact: 'Metrics are unavailable',
        issue: 'unreachable',
        target: 'Prometheus'
      })
    ).toBeUndefined();
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

describe('getTroubleshootingIssueLinks', () => {
  const namespaceIssue: TroubleshootingIssue = {
    category: 'data_plane',
    description: 'The mesh status reports the data plane namespace "bookinfo" is UNHEALTHY.',
    id: 'dp-ns-bookinfo',
    problem: 'Namespace "bookinfo" is UNHEALTHY',
    subProblems: [
      {
        id: 'sp-ns',
        impact: 'Workloads may be failing',
        issue: 'health is UNHEALTHY',
        severity: 'critical',
        target: 'Namespace: bookinfo'
      },
      {
        id: 'sp-wl',
        impact: 'Crash looping',
        issue: 'pod status is CrashLoopBackOff',
        severity: 'critical',
        target: 'Workload (Deployment): bookinfo/details-v1'
      }
    ]
  };

  it('links a namespace parent to the namespace view and graph in Kiali', () => {
    expect(getTroubleshootingIssueLinks(namespaceIssue, time)).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-namespace',
        label: 'View Namespace',
        to: '/namespaces/bookinfo?duration=300&refresh=60000'
      },
      {
        dataTest: 'ai-troubleshooting-check-graph',
        label: 'Check graph',
        to: '/graph/namespaces?traffic=ambient%2CambientTotal%2Cgrpc%2CgrpcRequest%2Chttp%2ChttpRequest%2Ctcp%2CtcpSent&graphType=versionedApp&namespaces=bookinfo&duration=300&refresh=60000&layout=dagre'
      }
    ]);
  });

  it('rewrites parent namespace and graph links for OSSMC', () => {
    expect(getTroubleshootingIssueLinks(namespaceIssue, { ...time, isOssmc: true })).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-namespace',
        label: 'View Namespace',
        to: '/k8s/cluster/projects/bookinfo/ossmconsole'
      },
      {
        dataTest: 'ai-troubleshooting-check-graph',
        label: 'Check graph',
        to: '/ossmconsole/graph?traffic=ambient%2CambientTotal%2Cgrpc%2CgrpcRequest%2Chttp%2ChttpRequest%2Ctcp%2CtcpSent&graphType=versionedApp&namespaces=bookinfo&duration=300&refresh=60000&layout=dagre'
      }
    ]);
  });

  it('links a namespace group parent and omits the graph when there are no graph nodes', () => {
    const istioOnly: TroubleshootingIssue = {
      category: 'namespace',
      id: 'group-ns-bookinfo',
      problem: 'Namespace: bookinfo',
      subProblems: [
        {
          id: 'sp-vs',
          impact: 'fails validation',
          issue: 'fails validation',
          istioObject: {
            group: 'networking.istio.io',
            kind: 'VirtualService',
            name: 'reviews',
            namespace: 'bookinfo',
            version: 'v1'
          },
          target: 'VirtualService: bookinfo/reviews'
        }
      ]
    };

    expect(getTroubleshootingIssueLinks(istioOnly, time)).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-namespace',
        label: 'View Namespace',
        to: '/namespaces/bookinfo?duration=300&refresh=60000'
      }
    ]);
  });

  it('puts View Mesh on the observability stack parent, not mesh-wide empty groups', () => {
    expect(
      getTroubleshootingIssueLinks(
        {
          category: 'observability_stack',
          description: 'Kiali cannot reach one or more observability backends or metric queries failed.',
          id: 'obs-001',
          problem: 'Observability stack has unreachable or unhealthy components',
          subProblems: [
            {
              id: 'sp-prom',
              impact: 'Metrics are unavailable',
              issue: 'unreachable',
              target: 'Prometheus'
            }
          ]
        },
        time
      )
    ).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-mesh',
        label: 'View Mesh',
        to: '/mesh?meshKiali=true&meshLayout=dagre&duration=300&refresh=60000'
      }
    ]);

    expect(
      getTroubleshootingIssueLinks(
        {
          category: 'observability_stack',
          id: 'obs-001',
          problem: 'Observability stack has unreachable or unhealthy components',
          subProblems: [
            {
              id: 'sp-grafana',
              impact: 'Dashboards are unavailable',
              issue: 'down',
              target: 'Grafana: istio-system/grafana'
            }
          ]
        },
        { ...time, isOssmc: true }
      )
    ).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-mesh',
        label: 'View Mesh',
        to: '/ossmconsole/mesh?meshKiali=true&meshLayout=dagre&duration=300&refresh=60000'
      }
    ]);
  });

  it('puts View Mesh on a mesh-wide group that contains observability targets', () => {
    expect(
      getTroubleshootingIssueLinks(
        {
          category: 'namespace',
          id: 'group-ns-Mesh-wide',
          problem: 'Mesh-wide',
          subProblems: [
            {
              id: 'sp-prom',
              impact: 'Metrics are unavailable',
              issue: 'unreachable',
              target: 'Prometheus'
            }
          ]
        },
        time
      )
    ).toEqual([
      {
        dataTest: 'ai-troubleshooting-view-mesh',
        label: 'View Mesh',
        to: '/mesh?meshKiali=true&meshLayout=dagre&duration=300&refresh=60000'
      }
    ]);
  });
});

describe('toOssmcConsoleUrl', () => {
  it('maps overview and graph/namespaces paths', () => {
    expect(toOssmcConsoleUrl('/overview?refresh=60000&duration=300')).toBe(
      '/ossmconsole/overview?refresh=60000&duration=300'
    );
    expect(toOssmcConsoleUrl('/graph/namespaces?namespaces=bookinfo&duration=300')).toBe(
      '/ossmconsole/graph?namespaces=bookinfo&duration=300'
    );
  });
});
