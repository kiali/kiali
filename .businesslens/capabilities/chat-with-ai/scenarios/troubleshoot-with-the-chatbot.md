---
kind: alternative
routes:
  web: Web
steps:
- text: The User switches the chatbot to Troubleshoot and describes the problem
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product has the model investigate step by step with Kiali's lookups and streams its findings
  kind: product
  actor: user
  entities: [{entity: conversation, effect: creates, facts: [Messages, Mode, Model, Last accessed]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Troubleshoot with the chatbot

## Trigger

The User is chasing a problem in the mesh.

## Outcome

The User has the model's diagnosis and suggested next steps.
