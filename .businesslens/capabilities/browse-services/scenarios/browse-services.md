---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Services and picks namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: service, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::services
- text: The Product lists each service with its type, health, labels and validations
  kind: product
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Type, Health, Labels, Validations]}, {entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::services
- text: The User filters and sorts by name, type, config type, sidecar presence, health or label
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::services
---

# Browse services

## Trigger

The User looks for a service.

## Outcome

The User finds a service and can open one.
