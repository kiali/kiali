---
domain: services
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/ServiceDetails/ServiceDetailsPage.tsx
- kind: code
  role: implementation
  target: business/services.go#SvcService
---

# View a service

A User opens one service to see its network, health, the Istio config that applies to it, its traffic and inbound metrics.
