import { Prompt } from 'types/Chatbot';

export const DataPrompts: { [key: string]: Prompt[] } = {
  applications: [
    {
      description: 'Report applications that may need attention, including health issues or missing sidecars',
      message: 'Report applications that may need attention, including health issues or missing sidecars',
      query:
        'Analyze the applications currently shown and report only the ones that may need attention, including health issues, traffic anomalies, or missing sidecars.',
      title: 'Application Health Analysis'
    }
  ],
  graph: [
    {
      description: 'Show me the current status of my service mesh graph',
      message: 'Show me the current status of my service mesh graph',
      query: 'Check my graph',
      title: 'Check Graph Status'
    }
  ],
  istio: [
    {
      description: 'Highlight Istio objects that may be misconfigured or likely to impact traffic',
      message: 'Highlight Istio objects that may be misconfigured or likely to impact traffic',
      query:
        'Review the Istio configuration currently shown and highlight objects that may be misconfigured, ineffective, or likely to impact traffic.',
      title: 'Istio Config Review'
    }
  ],
  mesh: [
    {
      description: 'Summarize mesh health with control plane status, cluster connectivity, and any warnings',
      message: 'Summarize mesh health with control plane status, cluster connectivity, and any warnings',
      query:
        'Summarize the current mesh health. Include control plane status, cluster connectivity, and only the most important warnings or unhealthy components.',
      title: 'Mesh Health Summary'
    }
  ],
  namespaces: [
    {
      description: 'List all namespaces with their sidecar injection status and Istio labels',
      message: 'List all namespaces with their sidecar injection status and Istio labels',
      query: 'List all namespaces and show their sidecar injection status and Istio labels',
      title: 'Namespace Overview'
    }
  ],
  overview: [
    {
      description: 'Give me a summary of the overall health of my mesh from the overview page',
      message: 'Give me a summary of the overall health of my mesh from the overview page',
      query: 'Check my overview',
      title: 'Analyze Overview'
    }
  ],
  services: [
    {
      description: 'Highlight services with unhealthy behavior, unusual traffic patterns, or configuration issues',
      message: 'Highlight services with unhealthy behavior, unusual traffic patterns, or configuration issues',
      query:
        'Review the services currently shown and highlight only services with unhealthy behavior, unusual traffic patterns, or likely configuration issues.',
      title: 'Service Health Analysis'
    }
  ],
  workloads: [
    {
      description: 'Report degraded workloads, missing sidecars, or other issues that may need troubleshooting',
      message: 'Report degraded workloads, missing sidecars, or other issues that may need troubleshooting',
      query:
        'Check the workloads currently shown and report degraded workloads, missing sidecars, or other issues that may need troubleshooting.',
      title: 'Workload Health Analysis'
    }
  ]
};
