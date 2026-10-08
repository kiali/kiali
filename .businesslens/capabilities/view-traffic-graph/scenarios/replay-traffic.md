---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Replay and a start time and length
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The Product redraws the graph frame by frame as the traffic was at each moment
  kind: product
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Source, Destination, Request rate, Error rate]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# Replay past traffic

## Trigger

The User wants to see how traffic changed during an incident.

## Outcome

The User watches the traffic of a past window unfold at the chosen speed.
