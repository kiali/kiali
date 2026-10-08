---
entities:
- {entity: istio-config, shows: [Name, Kind, Created, Labels, Specification, Validation, References], collects: [Specification]}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigDetails/IstioConfigDetailsPage.tsx
---

# Istio config details

One configuration object as YAML, with its validation findings marked where
they apply and the services, workloads and other objects it refers to.
