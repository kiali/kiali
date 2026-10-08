---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Delete in the actions of an Istio config object
  kind: actor
  actor: user
  entities: [{entity: istio-config, as: deleted, effect: reads, facts: [Kind, Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The User confirms that it cannot be undone
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product deletes the Istio config
  kind: product
  actor: user
  entities: [{entity: istio-config, as: deleted, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product returns the User to the Istio Config list of that namespace
  kind: product
  actor: user
  entities: [{entity: istio-config, as: remaining, effect: reads, facts: [Name, Kind, Validation]}, {entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
---

# Delete Istio config

## Trigger

The User wants an object out of the mesh.

## Outcome

The object is gone and the User is back on the Istio Config list.

## Edge cases

- A deletion the cluster refuses is reported and the User stays on the object
