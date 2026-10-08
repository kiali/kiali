---
kind: primary
routes:
  web: Web
steps:
- text: The User edits the YAML of an Istio config object
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The User chooses Save
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
- text: The Product applies the changes to the Istio config and revalidates it
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: changes, facts: [Specification, Labels, Annotations, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::istio-config-details
---

# Edit Istio config

## Trigger

The User wants to change how an object configures the mesh.

## Outcome

The object holds the new YAML and shows its new validation.

## Edge cases

- Reload discards the edits after confirming
- Leaving with unsaved edits asks for confirmation first
- A change the cluster refuses is shown in the editor with the cluster's message
