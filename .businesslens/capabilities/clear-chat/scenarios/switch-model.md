---
kind: alternative
routes:
  web: Web
steps:
- text: The User picks another provider or model
  kind: actor
  actor: user
  entities: [{entity: conversation, effect: reads, facts: [Model]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The User chooses Erase and start new chat
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product discards the conversation and selects the new model
  kind: product
  actor: user
  entities: [{entity: conversation, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Switch to another model

## Trigger

The User wants another model to answer.

## Outcome

The chat is empty and uses the chosen model.
