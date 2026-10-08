---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses the wizard that wrote the service's routing, now offered to update it
  kind: actor
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Traffic routing]}]
  contexts:
    web:
      place: web-console::signed-in::service-details
- text: The User changes the routing and confirms the preview of the Istio config
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
- text: The Product updates the routing Istio config
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: changes, facts: [Specification, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-routing-wizard
---

# Update traffic routing with the same wizard

## Trigger

The service already has routing from this wizard.

## Outcome

The service's traffic follows the updated routing.

## Edge cases

- A gateway the wizard created earlier is never updated
