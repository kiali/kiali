---
kind: primary
routes:
  web: Web
steps:
- text: The User opens the Envoy tab of a workload and picks a pod
  kind: actor
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Name]}, {entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product shows the proxy's upstreams, listeners, routes and bootstrap and full configuration
  kind: product
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Envoy configuration]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# View Envoy configuration

## Trigger

The User needs to know why a proxy routes the way it does.

## Outcome

The User sees each upstream with the DestinationRule and each route with the VirtualService behind it.
