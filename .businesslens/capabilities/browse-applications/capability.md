---
domain: applications
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/AppList/AppListPage.tsx
- kind: code
  role: implementation
  target: business/apps.go#AppService
---

# Browse applications

A User lists the applications of chosen namespaces across clusters.
