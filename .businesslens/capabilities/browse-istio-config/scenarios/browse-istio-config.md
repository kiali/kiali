---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Istio Config and picks namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: istio-config, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
- text: The Product lists each Istio config object with its kind and validation
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}, {entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
- text: The User filters and sorts by kind, name or validity
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::istio-config
---

# Browse Istio config

## Trigger

The User looks for an Istio config object.

## Outcome

The User finds an Istio config object and can open one.
