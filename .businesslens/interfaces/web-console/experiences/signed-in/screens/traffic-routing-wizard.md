---
entities:
- {entity: service, shows: [Name, Ports, Traffic routing]}
- {entity: workload, shows: [Version]}
- {entity: istio-config, shows: [Kind, Specification], collects: [Specification]}
references:
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/ServiceWizard.tsx
- kind: code
  role: implementation
  target: frontend/src/components/IstioWizards/WizardActions.ts#buildIstioConfig
---

# Traffic routing wizard

The wizard that describes how a service's traffic is routed, ending in a
preview of the routing objects it will write.
