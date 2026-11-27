/** Mock payload for POST /api/ai/troubleshooting used by Troubleshooting page tests. */
export const mockTroubleshootingIssues = [
  {
    category: 'data_plane',
    description: 'Service productpage is returning 5xx errors.',
    id: 'dp-001',
    problem: 'Service productpage has errors',
    subProblems: [
      {
        id: 'sp-001',
        impact: 'Requests to productpage are failing',
        issue: 'High HTTP 5xx error rate',
        severity: 'critical',
        suggestedActions: [
          {
            description: 'Analyze productpage errors',
            prompt: 'Why is productpage returning 5xx errors?',
            type: 'Analyze'
          }
        ],
        suggestedPrompt: 'Why is productpage failing?',
        target: 'Service: bookinfo/productpage'
      }
    ]
  },
  {
    category: 'data_plane',
    description: 'Workload is missing a sidecar.',
    id: 'dp-002',
    problem: 'Workload kiali-traffic-generator is misconfigured',
    subProblems: [
      {
        id: 'sp-wl-001',
        impact:
          'Workload (ReplicaSet) "kiali-traffic-generator" in namespace "bookinfo" is running without an Istio sidecar.',
        issue: 'missing Istio sidecar in injection-enabled namespace',
        severity: 'warning',
        suggestedPrompt: 'Why is the sidecar missing?',
        target: 'Workload (ReplicaSet): bookinfo/kiali-traffic-generator'
      }
    ]
  },
  {
    category: 'observability',
    description: 'Prometheus is unreachable.',
    id: 'obs-001',
    problem: 'Prometheus is down',
    subProblems: [
      {
        id: 'sp-prom-001',
        impact: 'Metrics are unavailable',
        issue: 'Prometheus endpoint is unreachable',
        severity: 'critical',
        suggestedPrompt: 'Why is Prometheus unreachable?',
        target: 'Prometheus'
      }
    ]
  },
  {
    category: 'configuration',
    description: 'VirtualService reviews fails validation.',
    id: 'cfg-001',
    problem: 'VirtualService reviews is invalid',
    subProblems: [
      {
        checks: [
          {
            code: 'KIA1107',
            message: 'Subset not found',
            path: 'spec/http[0]/route[1]/destination',
            severity: 'warning',
            suggestedPrompt: 'Why is route 1 missing a subset?'
          }
        ],
        id: 'sp-vs-001',
        impact: 'VirtualService "reviews" in namespace "bookinfo" fails validation.',
        issue: 'VirtualService "reviews" fails validation',
        istioObject: {
          group: 'networking.istio.io',
          kind: 'VirtualService',
          name: 'reviews',
          namespace: 'bookinfo',
          version: 'v1'
        },
        severity: 'warning',
        suggestedActions: [
          {
            description: 'Analyze VirtualService reviews',
            prompt: 'Analyze the YAML of VirtualService reviews',
            type: 'Analyze'
          }
        ],
        suggestedPrompt: 'Why does VirtualService reviews fail validation?',
        target: 'VirtualService: bookinfo/reviews'
      }
    ]
  }
];
