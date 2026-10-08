---
appliesTo:
- {type: entity, id: istio-config}
- {type: capability, id: create-istio-config}
- {type: capability, id: edit-istio-config}
- {type: capability, id: delete-istio-config}
references:
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizard.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigNew/IstioConfigNewPage.tsx
---

# Writing several Istio config objects at once can partly succeed

A form, wizard or namespace action that writes several objects — one per
chosen namespace and cluster, or a routing or policy set — writes each one
separately. Objects the cluster accepted stay when another is refused, and the
Product reports each failure.
