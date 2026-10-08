---
entities:
- {entity: service, shows: [Name, Type, Health, Labels, Validations]}
- {entity: namespace, shows: [Name]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/ServiceList/ServiceListPage.tsx
---

# Services

The services of the selected namespaces.
