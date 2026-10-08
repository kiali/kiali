---
entities:
- {entity: application, shows: [Name, Health, Labels]}
- {entity: namespace, shows: [Name]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/AppList/AppListPage.tsx
---

# Applications

The applications of the selected namespaces.
