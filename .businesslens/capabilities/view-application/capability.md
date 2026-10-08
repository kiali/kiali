---
domain: applications
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/AppDetails/AppDetailsPage.tsx
- kind: code
  role: implementation
  target: business/apps.go#AppService
---

# View an application

A User opens one application to see its workloads, services, health, traffic and metrics.
