---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Edit annotations on a namespace and changes them
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Annotations]}]
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
- text: The Product writes the new annotations to the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Annotations]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Edit annotations of a namespace

## Trigger

The User needs different annotations on a namespace.

## Outcome

The namespace carries the saved annotations.
