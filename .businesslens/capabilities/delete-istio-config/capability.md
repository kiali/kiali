---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/components/IstioActions/IstioActionsDropdown.tsx
- kind: code
  role: implementation
  target: handlers/istio_config.go#IstioConfigDelete
- kind: code
  role: implementation
  target: business/istio_config.go#DeleteIstioConfigDetail
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizardDropdown.tsx
- kind: code
  role: implementation
  target: frontend/src/services/Api.ts#deleteServiceTrafficRouting
- kind: code
  role: implementation
  target: frontend/src/pages/Namespaces/NamespaceTrafficPolicies.tsx
---

# Delete Istio config

A User deletes Istio config after confirming: one object from its page, all the
routing of a service with Delete Traffic Routing, all the AuthorizationPolicies
and Sidecars of a namespace with Delete Traffic Policies, or a deletion the AI
chatbot proposed.
