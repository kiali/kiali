---
domain: istio-config
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: controller/validations.go
- kind: code
  role: implementation
  target: business/istio_validations.go
- kind: code
  role: implementation
  target: config/config.go#IstioConfig
---

# Validate Istio config

The Product checks all Istio config against the rest of the mesh on its own, at
the validation interval, so the Istio Config list, detail pages, Overview and
Traffic Graph show current findings. It runs only while the validation interval
is above zero.
