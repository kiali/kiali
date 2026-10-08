---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Graph/GraphPage.tsx
- kind: code
  role: implementation
  target: handlers/graph.go#GraphNamespaces
- kind: code
  role: implementation
  target: graph/options.go#NewOptions
---

# View the traffic graph

A User sees the observed traffic between the applications, workloads and
services of chosen namespaces for a chosen time, as an app, versioned app,
workload or service graph, and inspects any node or edge. Display options,
find and hide expressions, layouts and replay shape the same view. Traffic
needs Prometheus.
