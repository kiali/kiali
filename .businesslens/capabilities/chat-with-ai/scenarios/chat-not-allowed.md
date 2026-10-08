---
kind: validation
routes:
  web: Web
steps:
- text: The User opens the chatbot and sends a question
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The User is not among the chat allowed users
  kind: condition
  actor: user
  entities: [{entity: kiali-configuration, effect: reads, facts: [Chat allowed users]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product shows that the chatbot is not allowed for this user and answers nothing
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# A User outside the allowed users cannot chat

## Trigger

Chat allowed users are set.

## Outcome

No conversation starts.
