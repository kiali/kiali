---
entities:
- {entity: service, shows: [Name, Type, Created, IP, Ports, Endpoints, Hostnames, Health, Labels, Annotations, Traffic routing, Validations, Inbound metrics], collects: [Labels, Annotations]}
- {entity: istio-config, shows: [Name, Kind, Validation]}
- {entity: workload, shows: [Name]}
- {entity: edge, shows: [Source, Destination, Request rate, Error rate]}
- {entity: trace, shows: [Trace ID, Start time, Duration, Errors, Spans]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/ServiceDetails/ServiceDetailsPage.tsx
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizardDropdown.tsx
---

# Service details

One service: its network, the Istio config that applies to it, health,
traffic, inbound metrics and traces, and the traffic routing actions.
