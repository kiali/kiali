---
kind: primary
routes:
  web: Web
steps:
- text: The User opens the chatbot and sends a question or a suggested prompt for the page
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product sends the question and page context to the chosen language model and streams its answer, showing each lookup it made
  kind: product
  actor: user
  entities: [{entity: conversation, effect: creates, facts: [Messages, Mode, Model, Last accessed]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product adds the tokens the answer cost to the session's token stats
  kind: product
  actor: user
  entities: [{entity: session, effect: changes, facts: [Token usage]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Ask the chatbot

## Trigger

The User has a question about what they are looking at.

## Outcome

The User reads an answer grounded in the current state of the mesh, with links to documentation where relevant.

## Edge cases

- A follow-up question continues the same conversation with its history
- The User can stop an answer while it streams
- An answer cut off by the model's output limit is marked as truncated
- Without the conversation store each question is answered without history
