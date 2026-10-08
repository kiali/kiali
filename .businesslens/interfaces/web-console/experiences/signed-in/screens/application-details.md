---
entities:
- {entity: application, shows: [Name, Health, Mode, Labels, Inbound metrics, Outbound metrics, Runtime metrics]}
- {entity: workload, shows: [Name]}
- {entity: service, shows: [Name]}
- {entity: edge, shows: [Source, Destination, Request rate, Error rate]}
- {entity: trace, shows: [Trace ID, Start time, Duration, Errors, Spans]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/AppDetails/AppDetailsPage.tsx
---

# Application details

One application: its workloads and services, health, traffic, inbound and
outbound metrics and traces.
