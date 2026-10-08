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

# Remove Auto Injection

A User removes an explicit auto injection setting from a namespace or workload, leaving it to the mesh default. It is offered while auto injection actions are enabled, for namespaces and workloads not in ambient, and for namespaces only outside the control plane and while revision switching is disabled.
