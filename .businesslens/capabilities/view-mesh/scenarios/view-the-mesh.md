---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Mesh
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::mesh
- text: The Product draws each cluster with its control planes and the data plane namespaces they manage
  kind: product
  actor: user
  entities: [{entity: cluster, effect: reads, facts: [Name, Home cluster, Kubernetes version, API endpoint, Mesh]}, {entity: control-plane, effect: reads, facts: [Revision, Version, Status, Managed namespaces]}, {entity: namespace, effect: reads, facts: [Name, Health, mTLS, Mode, Labels, Istio config summary]}]
  contexts:
    web:
      place: web-console::signed-in::mesh
- text: The User selects a control plane
  kind: actor
  actor: user
  entities: [{entity: control-plane, effect: reads, facts: [Revision]}]
  contexts:
    web:
      place: web-console::signed-in::mesh
- text: The Product shows its version, mesh mTLS, outbound traffic policy, mesh configuration, certificates and resource usage
  kind: product
  actor: user
  entities: [{entity: control-plane, effect: reads, facts: [Version, Mesh mTLS, Outbound traffic policy, Mesh configuration, Certificates, Resource usage]}]
  contexts:
    web:
      place: web-console::signed-in::mesh
---

# View the mesh

## Trigger

The User wants to know how the mesh is deployed.

## Outcome

The User knows which control plane manages which namespaces and how it is configured.

## Edge cases

- Control planes in namespaces the User cannot access are left out
- Gateways, waypoints and Kiali itself are drawn only when the User turns them on
- Find and hide expressions highlight or hide parts of the mesh by name, cluster, namespace, type, label or health
