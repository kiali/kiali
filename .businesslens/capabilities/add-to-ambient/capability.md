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

# Add to Ambient

A User enrolls a namespace's workloads in the ambient data plane. It is offered while ambient is installed, for namespaces outside the control plane without sidecar injection labels.
