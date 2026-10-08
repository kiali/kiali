---
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WorkloadWizardActionsDropdownGroup.tsx
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WizardActions.ts#buildNamespaceInjectionPatch
---

# Disable Auto Injection

A User stops the sidecar being added to new pods of a namespace or of one workload. It is offered while auto injection actions are enabled, for namespaces and workloads not in ambient, and for namespaces only outside the control plane and while revision switching is disabled.
