---
entities:
- {entity: workload, shows: [Name, Type, Created, Version, Mode, Auto injection, Waypoint, Health, Labels, Annotations, Istio proxy status, Validations, Inbound metrics, Outbound metrics, Runtime metrics], collects: [Labels, Annotations]}
- {entity: pod, shows: [Name, Status, Containers, Revision, Logs, Envoy configuration], collects: [Proxy log level]}
- {entity: edge, shows: [Source, Destination, Request rate, Error rate]}
- {entity: trace, shows: [Trace ID, Start time, Duration, Errors, Spans]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadDetails/WorkloadDetailsPage.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/WorkloadDetails/WorkloadPodLogs.tsx
---

# Workload details

One workload: its pods and proxies, health, traffic, metrics, traces, the logs
of its pods and the Envoy configuration of their proxies.
