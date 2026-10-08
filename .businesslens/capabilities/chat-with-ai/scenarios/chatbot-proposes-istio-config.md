---
kind: alternative
routes:
  web: Web
steps:
- text: The User asks the chatbot to write configuration for the mesh
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product answers with a preview of the Istio config to create, patch or delete, which nothing applies yet
  kind: product
  actor: user
  entities: [{entity: conversation, effect: changes, facts: [Messages, Last accessed]}, {entity: istio-config, effect: reads, facts: [Kind, Name]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# The chatbot proposes Istio config

## Trigger

The User wants the chatbot to write configuration.

## Outcome

A proposed file waits in the chat for the User to apply or ignore.
