---
domain: istio-config
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigDetails/IstioConfigDetailsPage.tsx
- kind: code
  role: implementation
  target: business/istio_validations.go
---

# View an Istio config object

A User opens one Istio config object to read it and its validation.
