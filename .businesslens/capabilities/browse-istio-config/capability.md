---
domain: istio-config
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigList/IstioConfigListPage.tsx
---

# Browse Istio config

A User lists the Istio config of chosen namespaces across clusters with each object's validation.
