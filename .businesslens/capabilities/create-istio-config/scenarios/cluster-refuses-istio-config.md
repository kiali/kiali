---
kind: edge
routes:
  web: Web
steps:
- text: The User reviews the preview of the Istio config and chooses Create
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The cluster refuses it, because an object of that name exists or the User's role does not allow it
  kind: condition
  actor: user
  entities: [{entity: kubernetes-role, effect: reads, facts: [Permissions]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The Product shows that it could not create the Istio config, with the cluster's message
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
---

# The cluster refuses the new Istio config

## Trigger

The User creates Istio config the cluster will not accept.

## Outcome

Nothing is created where the cluster refused, and the User stays on the form.
