---
entities:
- {entity: cluster, shows: [Name, Istio component status]}
- {entity: control-plane, shows: [Revision, Status]}
- {entity: namespace, shows: [Name, Health, Mode]}
- {entity: istio-config, shows: [Name, Kind, Validation]}
- {entity: application, shows: [Health, Inbound metrics, Outbound metrics]}
- {entity: service, shows: [Name, Health, Inbound metrics]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Overview/OverviewPage.tsx#OverviewPage
---

# Overview

The landing view summarizing the whole mesh for the health window: clusters,
control planes and data planes by health, Istio config with warnings or
errors, application health and request rates, and the services with the most
errors, latency or throughput.
