---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Overview
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::overview
- text: The Product counts healthy and unhealthy clusters, control planes and data plane namespaces
  kind: product
  actor: user
  entities: [{entity: cluster, effect: reads, facts: [Name, Istio component status]}, {entity: control-plane, effect: reads, facts: [Revision, Status]}, {entity: namespace, effect: reads, facts: [Name, Health, Mode]}]
  contexts:
    web:
      place: web-console::signed-in::overview
- text: The Product lists the Istio config with warnings or errors
  kind: product
  actor: user
  entities: [{entity: istio-config, effect: reads, facts: [Name, Kind, Validation]}]
  contexts:
    web:
      place: web-console::signed-in::overview
- text: The Product charts application health and total inbound and outbound request rates
  kind: product
  actor: user
  entities: [{entity: application, effect: reads, facts: [Health, Inbound metrics, Outbound metrics]}]
  contexts:
    web:
      place: web-console::signed-in::overview
- text: The Product ranks the services with the most errors, P95 latency and throughput
  kind: product
  actor: user
  entities: [{entity: service, effect: reads, facts: [Name, Health, Inbound metrics]}]
  contexts:
    web:
      place: web-console::signed-in::overview
---

# View the overview

## Trigger

The User opens the console or chooses Overview.

## Outcome

The User knows where the mesh is unhealthy or misconfigured and can follow a link there.

## Edge cases

- Health not yet computed in the background shows as unknown rather than being computed on demand
- Which service rankings show is a choice the User keeps in the browser
