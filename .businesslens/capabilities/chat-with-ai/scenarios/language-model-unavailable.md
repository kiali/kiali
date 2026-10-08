---
kind: edge
routes:
  web: Web
steps:
- text: The User sends a question
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The provider cannot be reached, rejects the key or returns an error
  kind: condition
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product shows the error in the chat, keeping any partial answer
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# The language model fails

## Trigger

The provider is down, misconfigured or rejects the request.

## Outcome

The question is unanswered and the User may retry.

## Edge cases

- A model that keeps looking things up stops after the configured number of tool iterations with an error
