---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Remove Ambient in the actions of a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Ambient enrollment]}]
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
- text: The Product removes the data plane mode label on the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Ambient enrollment, Mode]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Remove Ambient

## Trigger

The User changes whether a namespace's workloads use the ambient data plane.

## Outcome

The namespace's ambient enrollment and mode reflect the change.
