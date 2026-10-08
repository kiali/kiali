---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Delete Traffic Routing in the actions of a service
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Traffic routing]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The Product deletes the routing Istio config of the service
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: removes}, {entity: service, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
---

# Delete traffic routing

## Trigger

The User wants the service back to default routing.

## Outcome

The service has no routing and every wizard is offered again.
