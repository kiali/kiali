---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Edit labels on a service and changes them
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Labels]}]
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
- text: The Product writes the new labels to the service
  kind: product
  actor: user
  entities: [{entity: service, effect: changes, facts: [Labels]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# Edit labels of a service

## Trigger

The User needs different labels on a service.

## Outcome

The service carries the saved labels.
