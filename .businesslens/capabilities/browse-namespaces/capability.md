---
domain: namespaces
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Namespaces/NamespacesPage.tsx
- kind: code
  role: implementation
  target: business/namespaces.go#NamespaceService
---

# Browse namespaces

A User lists every namespace they may see across clusters, with its type, data
plane mode, revision, health, mTLS and Istio config summary.
