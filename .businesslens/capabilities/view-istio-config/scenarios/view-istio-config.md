---
kind: primary
routes:
  web: Web
steps:
- text: The User opens an Istio config object
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product shows its YAML with each validation finding marked where it applies, and what it refers to
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Created, Labels, Specification, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
---

# View an Istio config object

## Trigger

The User selects an Istio config object.

## Outcome

The User knows what the object says and what is wrong with it.

## Edge cases

- Findings also go to the notification center
- A help message explains the YAML line the User selects
