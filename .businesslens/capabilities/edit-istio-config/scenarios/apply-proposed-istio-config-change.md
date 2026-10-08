---
kind: alternative
routes:
  web: Web
steps:
- text: The User opens the proposed file in the chat and reviews its YAML
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Name, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The User chooses Patch
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product applies the change to the Istio config and reports the result in the chat
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: changes, facts: [Specification, Labels, Annotations, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Apply a change the chatbot proposed

## Trigger

An answer of the AI chatbot proposed a change to existing Istio config.

## Outcome

The object holds the proposed change.
