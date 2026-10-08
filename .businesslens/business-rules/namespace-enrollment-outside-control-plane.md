---
appliesTo:
- type: entity
  id: namespace
  effect: changes
  facts: [Auto injection, Ambient enrollment, Revision]
permits:
- configuredBy: kubernetes-role
  when: [{fact: Type, is-not: Control plane}]
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
---

# Only namespaces outside the control plane change their mesh enrollment

The console offers auto injection, ambient and revision actions only for data
plane namespaces and namespaces outside the mesh, never for a namespace that
runs a control plane.
