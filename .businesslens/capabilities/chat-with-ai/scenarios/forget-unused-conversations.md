---
kind: edge
routes:
  web: Web
steps:
- text: No question has used a conversation for the conversation inactivity timeout
  kind: condition
  unattended: true
  entities: [{entity: conversation, effect: reads, facts: [Last accessed]}, {entity: kiali-configuration, effect: reads, facts: [Conversation inactivity timeout]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product discards the conversation
  kind: product
  entities: [{entity: conversation, effect: removes}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
---

# Unused conversations are forgotten

## Trigger

Time passes without the conversation being used.

## Outcome

A later question starts without that history.

## Edge cases

- When conversations use more memory than allowed the least recently used are discarded first
