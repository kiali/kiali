---
kind: alternative
routes:
  web: Web
steps:
- text: The User opens the proposed file in the chat and reviews it
  kind: actor
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Kind, Name, Specification]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The User chooses Delete
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product deletes the Istio config and reports the result in the chat
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Apply a deletion the chatbot proposed

## Trigger

An answer of the AI chatbot proposed deleting Istio config.

## Outcome

The object is gone.
