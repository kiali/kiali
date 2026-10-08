---
entities:
- {entity: istio-config, shows: [Name, Kind, Validation]}
- {entity: namespace, shows: [Name]}
- {entity: cluster, shows: [Name]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigList/IstioConfigListPage.tsx
---

# Istio Config

The Istio and Gateway API configuration objects of the selected namespaces,
with their validation.
