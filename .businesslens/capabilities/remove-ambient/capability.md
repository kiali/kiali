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

# Remove Ambient

A User removes a namespace's ambient setting. It is offered while ambient is installed, for namespaces outside the control plane without sidecar injection labels.
