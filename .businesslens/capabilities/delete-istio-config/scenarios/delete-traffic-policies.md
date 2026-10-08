---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Delete Traffic Policies in the actions of a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The User confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product deletes the namespace's AuthorizationPolicies and Sidecars
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: removes}, {entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Delete traffic policies

## Trigger

The User wants the namespace's traffic unrestricted again.

## Outcome

No AuthorizationPolicy or Sidecar remains in the namespace.
