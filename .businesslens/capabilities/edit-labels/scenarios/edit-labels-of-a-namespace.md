---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Edit labels on a namespace and changes them
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Labels]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The User saves
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::namespace-details
- text: The Product writes the new labels to the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Labels]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Edit labels of a namespace

## Trigger

The User needs different labels on a namespace.

## Outcome

The namespace carries the saved labels.
