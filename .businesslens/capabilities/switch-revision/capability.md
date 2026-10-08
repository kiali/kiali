---
domain: namespaces
availability:
- {place: 'web-console::signed-in'}
references:
- kind: code
  role: implementation
  target: frontend/src/pages/NamespaceDetails/namespaceDetailActions.ts#buildNamespaceRowActions
---

# Switch revision

A User moves a namespace to another Istio control plane revision during a
canary upgrade. It is offered while revision switching is enabled, for a namespace
outside the control plane that already has a revision, listing each other
revision whose control plane manages the namespace's cluster.
