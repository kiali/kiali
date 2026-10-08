---
kind: primary
result: achieved
routes:
  web: Web
steps:
- text: The User fills in the form for an Istio config kind and chooses Create
  kind: actor
  actor: user
  capability: create-istio-config
  entities: [{entity: istio-config, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::new-istio-config
- text: The Product returns the User to the Istio Config list
  kind: product
  actor: user
  capability: create-istio-config
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
- text: The User finds the new Istio config and its validation in the list
  kind: actor
  actor: user
  capability: browse-istio-config
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config
---

# Add Istio config from a form

## Trigger

The User creates Istio config from the Create menu.

## Outcome

The User sees the new object listed and whether it is valid.
