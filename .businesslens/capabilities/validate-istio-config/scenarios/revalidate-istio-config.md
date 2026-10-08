---
kind: primary
routes:
  web: Web
steps:
- text: The validation interval has passed since the last check
  kind: condition
  unattended: true
  entities: [{entity: kiali-configuration, effect: reads, facts: [Validation interval]}]
  contexts:
    web:
      place: web-console::signed-in
- text: The Product checks every Istio config object against the mesh and records its findings and references
  kind: product
  entities:
  - {entity: kiali-configuration, effect: reads, facts: [Ignored validations]}
  - {entity: istio-config, effect: changes, facts: [Validation, References]}
  contexts:
    web:
      place: web-console::signed-in
---

# Revalidate Istio config

## Trigger

The validation interval passes.

## Outcome

Every Istio config object carries findings for the mesh as it is now.

## Edge cases

- When nothing relevant changed since the last check, the previous findings are kept
- Objects annotated to skip validation and validation codes Kiali is told to ignore are never reported
