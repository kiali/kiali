---
domain: namespaces
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WizardActions.ts#buildNamespaceAmbientPatch
---

# Disable Ambient

A User explicitly keeps a namespace out of the ambient data plane. It is offered while ambient is installed, for namespaces outside the control plane without sidecar injection labels.
