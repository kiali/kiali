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
- text: The User edits the YAML if needed and chooses Create
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product creates the Istio config and reports the result in the chat
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: creates, facts: [Name, Kind, Created, Labels, Annotations, Specification, Validation, References]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Apply Istio config the chatbot proposed

## Trigger

An answer of the AI chatbot proposed new Istio config.

## Outcome

The proposed object exists in the namespace it names.
