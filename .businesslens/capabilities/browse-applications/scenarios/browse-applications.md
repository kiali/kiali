---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Applications and picks namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: application, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::applications
- text: The Product lists each application with its health and labels
  kind: product
  actor: user
  entities: [{entity: application, effect: reads, facts: [Name, Health, Labels]}, {entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::applications
- text: The User filters and sorts by name, config type, sidecar presence, health or label
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::applications
---

# Browse applications

## Trigger

The User looks for an application.

## Outcome

The User finds an application and can open one.
