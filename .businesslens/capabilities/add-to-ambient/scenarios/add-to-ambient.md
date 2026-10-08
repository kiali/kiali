---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Add to Ambient in the actions of a namespace
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
- text: The Product sets the data plane mode label to ambient on the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Ambient enrollment, Mode]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Add to Ambient

## Trigger

The User changes whether a namespace's workloads use the ambient data plane.

## Outcome

The namespace's ambient enrollment and mode reflect the change.
