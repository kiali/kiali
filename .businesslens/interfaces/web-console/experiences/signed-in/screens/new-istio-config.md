---
entities:
- {entity: istio-config, shows: [Kind, Specification], collects: [Name, Labels, Annotations, Specification]}
- {entity: namespace, shows: [Name]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigNew/IstioConfigNewPage.tsx
---

# New Istio config

The form for one kind of Istio config, ending in a preview of the objects to
create in each chosen namespace and cluster.
