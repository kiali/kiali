---
appliesTo:
- type: entity
  id: workload
  effect: changes
  facts: [Auto injection]
permits:
- configuredBy: kubernetes-role
  when:
  - {entity: kiali-configuration, fact: Auto injection actions, is: Enabled}
  - {fact: Mode, is-not: Ambient}
references:
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WorkloadWizardDropdown.tsx
---

# A workload's auto injection changes only while injection actions are enabled and the workload is not in ambient

The console changes a workload's inject label only while auto injection actions are enabled, and never for a workload in the ambient data plane.
