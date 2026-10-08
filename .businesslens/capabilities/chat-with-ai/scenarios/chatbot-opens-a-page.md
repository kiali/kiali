---
kind: alternative
routes:
  web: Web
steps:
- text: The User allows the chatbot to navigate and asks it to show the traffic graph
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product answers and records the exchange
  kind: product
  actor: user
  entities: [{entity: conversation, effect: changes, facts: [Messages, Last accessed]}]
  contexts:
    web:
      place: web-console::signed-in::chatbot
- text: The Product opens the Traffic Graph of the namespace in question
  kind: product
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# The chatbot opens a page

## Trigger

The User asks for something a console page shows.

## Outcome

The User is on the page that shows it; without allowing navigation the answer offers a link instead.
