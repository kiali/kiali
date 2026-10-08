---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Create and an Istio config kind on the Istio Config list
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
- text: The User fills in the name, namespaces, clusters, labels, annotations and the kind's settings
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The User reviews the preview of the Istio config and chooses Create
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The Product creates the Istio config in each chosen namespace and cluster and validates it
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}, {entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The Product reports the creation and returns the User to the Istio Config list
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
---

# Create Istio config from a form

## Trigger

The User wants to add a policy, gateway or other config to the mesh.

## Outcome

The new objects exist in the chosen namespaces and the User is back on the Istio Config list.
