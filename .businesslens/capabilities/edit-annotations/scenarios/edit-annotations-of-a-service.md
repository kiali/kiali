---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Edit annotations on a service and changes them
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Annotations]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User saves
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product writes the new annotations to the service
  kind: product
  actor: user
  entities: [{entity: service, effect: changes, facts: [Annotations]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# Edit annotations of a service

## Trigger

The User needs different annotations on a service.

## Outcome

The service carries the saved annotations.
