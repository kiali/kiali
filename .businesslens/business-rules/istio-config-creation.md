---
appliesTo:
- type: entity
  id: istio-config
  effect: creates
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

# Only people whose Kubernetes role allows it create Istio config, and never in view only mode

A User may create an Istio config object in a namespace only while their Kubernetes role there allows it to create that kind, and nobody may while view only mode is on.

## Rationale

Kiali changes the clusters with the signed-in person's own credentials, so their Kubernetes roles decide what the cluster accepts; Kiali checks the same roles first to offer only what will succeed, and view only mode lets a team deploy Kiali as a read-only console.
