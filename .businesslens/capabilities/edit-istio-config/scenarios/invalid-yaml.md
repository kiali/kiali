---
kind: validation
routes:
  web: Web
steps:
- text: The User edits the YAML of an Istio config object
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Specification]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product marks each syntax error in the editor and keeps Save unavailable
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
---

# YAML with syntax errors cannot be saved

## Trigger

The User types YAML that does not parse.

## Outcome

Nothing is saved until the YAML is fixed.
