---
appliesTo:
- type: entity
  id: namespace
  effect: changes
permits:
- configuredBy: kubernetes-role
  when: [{entity: kiali-configuration, fact: View only mode, is: 'Off'}]
references:
- kind: code
  role: implementation
  target: business/istio_config.go#getPermissionsApi
- kind: code
  role: implementation
  target: frontend/src/types/Permissions.ts
---

# Only people whose Kubernetes role allows it change a namespace, and never in view only mode

Labels, annotations and mesh enrollment of a namespace change only for a User whose Kubernetes role allows patching it, and for nobody while view only mode is on.

## Rationale

Kiali changes the clusters with the signed-in person's own credentials, so their Kubernetes roles decide what the cluster accepts; Kiali checks the same roles first to offer only what will succeed, and view only mode lets a team deploy Kiali as a read-only console.
