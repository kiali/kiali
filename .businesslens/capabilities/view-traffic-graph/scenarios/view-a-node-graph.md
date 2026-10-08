---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Node Graph on a workload
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The Product draws only the traffic into and out of that workload
  kind: product
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Health]}, {entity: edge, effect: reads, facts: [Source, Destination, Request rate, Error rate]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# View the traffic around one node

## Trigger

The User wants to focus on one application, workload or service.

## Outcome

The User sees that node's immediate callers and callees, and can go back to the full graph.

## Edge cases

- Nodes outside the mesh and idle nodes cannot be focused
