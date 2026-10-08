---
entities:
- {entity: namespace, shows: [Name]}
- {entity: application, shows: [Name, Health]}
- {entity: workload, shows: [Name, Health, Missing sidecar]}
- {entity: service, shows: [Name, Health, Traffic routing]}
- {entity: edge, shows: [Source, Destination, Protocol, Request rate, Error rate, Response time, Throughput, Traffic distribution, mTLS, Principals, Response flags]}
- {entity: trace, shows: [Trace ID, Duration, Spans]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Graph/GraphPage.tsx
- kind: code
  role: implementation
  target: handlers/graph.go#GraphNamespaces
---

# Traffic Graph

The observed traffic between applications, workloads and services of the
selected namespaces for a chosen time, or around one node, with a side panel
for whatever is selected.
