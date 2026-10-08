---
kind: primary
result: achieved
routes:
  web: Web
steps:
- text: The User deletes an Istio config object and confirms
  kind: actor
  actor: user
  capability: delete-istio-config
  entities: [{entity: istio-config, as: deleted, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product returns the User to the Istio Config list of that namespace
  kind: product
  actor: user
  capability: delete-istio-config
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: istio-config, as: remaining, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
- text: The User reviews the Istio config left in the namespace
  kind: actor
  actor: user
  capability: browse-istio-config
  entities: [{entity: istio-config, as: remaining, effect: reads, facts: [Name, Kind, Validation]}, {entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
---

# Remove Istio config from its page

## Trigger

The User deletes an object from its page.

## Outcome

The User sees the namespace's remaining config.
