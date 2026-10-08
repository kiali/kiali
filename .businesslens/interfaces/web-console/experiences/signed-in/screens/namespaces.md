---
entities:
- {entity: namespace, shows: [Name, Type, Mode, Revision, Health, mTLS, Istio config summary, Labels]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/Namespaces/NamespacesPage.tsx
---

# Namespaces

Every namespace the person may see, across clusters, with its place in the mesh.
