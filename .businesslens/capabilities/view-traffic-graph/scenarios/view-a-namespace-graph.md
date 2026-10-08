---
kind: primary
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
- text: The Product draws the nodes with their health and the edges with their rates for the chosen time
  kind: product
  actor: user
  entities: [{entity: application, effect: reads, facts: [Name, Health]}, {entity: workload, effect: reads, facts: [Name, Health, Missing sidecar]}, {entity: service, effect: reads, facts: [Name, Health, Traffic routing]}, {entity: edge, effect: reads, facts: [Source, Destination, Protocol, Request rate, Error rate, Response time, Throughput, Traffic distribution, mTLS]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The User selects an edge
  kind: actor
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Source, Destination]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
- text: The Product shows its rates by response code, response flags and the identities on both ends
  kind: product
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Request rate, Error rate, Response flags, mTLS, Principals]}]
  contexts:
    web:
      place: web-console::signed-in::traffic-graph
---

# View the traffic of namespaces

## Trigger

The User wants to see how traffic flows through some namespaces.

## Outcome

The User sees who calls whom, how much and how well, and where it fails.

## Edge cases

- Nodes in namespaces the User cannot access appear without details or actions
- With no namespace selected, or no traffic in the chosen time, the graph is empty
- Idle nodes and edges, service nodes, operation nodes, security badges, traffic animation and cluster or namespace boxes are display options
- Find and hide expressions highlight or hide nodes and edges by name, label, rate, health or protocol
- Repeated loads are served from a per-session cache that the Product refreshes in the background
