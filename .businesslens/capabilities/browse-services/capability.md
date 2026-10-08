---
domain: services
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/ServiceList/ServiceListPage.tsx
---

# Browse services

A User lists the services of chosen namespaces across clusters, with the validation of the config that applies to them.
