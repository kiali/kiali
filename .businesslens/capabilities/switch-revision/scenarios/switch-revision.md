---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Switch to a revision in the actions of a namespace
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name, Revision]}, {entity: control-plane, effect: reads, facts: [Revision]}]
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
- text: The Product removes the injection label and sets the revision label on the namespace
  kind: product
  actor: user
  entities: [{entity: namespace, effect: changes, facts: [Auto injection, Revision]}]
  contexts:
    web:
      place: web-console::signed-in::namespace-details
---

# Switch a namespace to another revision

## Trigger

The User is upgrading Istio revision by revision.

## Outcome

New pods in the namespace are injected by the chosen revision.
