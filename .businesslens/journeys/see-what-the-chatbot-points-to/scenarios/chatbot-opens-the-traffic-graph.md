---
kind: primary
result: achieved
routes:
  web: Web
steps:
- text: The User allows the chatbot to navigate and asks it to show the traffic graph
  kind: actor
  actor: user
  capability: chat-with-ai
  entities: [{entity: conversation, effect: changes, facts: [Messages, Last accessed]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product opens the Traffic Graph of the namespace in question
  kind: product
  actor: user
  capability: chat-with-ai
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The User selects an edge to inspect it
  kind: actor
  actor: user
  capability: view-traffic-graph
  entities: [{entity: edge, effect: reads, facts: [Source, Destination]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# The chatbot opens the traffic graph

## Trigger

The User asks the chatbot about traffic.

## Outcome

The User inspects the traffic the chatbot opened.
