---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Clear chat and confirms
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product discards the conversation and empties the chat
  kind: product
  actor: user
  entities: [{entity: conversation, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Clear the chat

## Trigger

The User wants a fresh start.

## Outcome

The chat is empty and the next question starts a new conversation.
