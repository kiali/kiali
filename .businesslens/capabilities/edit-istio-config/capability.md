---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/IstioConfigDetails/IstioConfigDetailsPage.tsx
- kind: code
  role: implementation
  target: handlers/istio_config.go#IstioConfigUpdate
- kind: code
  role: implementation
  target: business/istio_config.go#UpdateIstioConfigDetail
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizard.tsx
- kind: code
  role: implementation
  target: frontend/src/pages/Namespaces/NamespaceTrafficPolicies.tsx
---

# Edit Istio config

A User changes Istio config already in the mesh: by editing an object's YAML
and saving it, by updating a service's routing with the wizard that wrote it,
by choosing Update Traffic Policies on a namespace that already has
AuthorizationPolicies, or by applying a change the AI chatbot proposed. Any
kind Kiali manages can be edited.
