---
kind: edge
routes:
  web: Web
steps:
- text: The User opens Traffic Graph and selects namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: Prometheus is unavailable
  kind: condition
  entities: []
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The Product shows that metrics are disabled instead of a graph
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# The graph has no metrics to draw

## Trigger

Prometheus cannot be reached or is turned off.

## Outcome

No graph is drawn.
