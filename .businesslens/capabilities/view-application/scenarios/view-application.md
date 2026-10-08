---
kind: primary
routes:
  web: Web
steps:
- text: The User opens an application
  kind: actor
  actor: user
  entities: [{entity: application, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::application-details
- text: The Product shows its health, mode, workloads and services
  kind: product
  actor: user
  entities: [{entity: application, effect: reads, facts: [Name, Health, Mode, Labels]}, {entity: workload, effect: reads, facts: [Name]}, {entity: service, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::application-details
- text: The User opens the Traffic, Inbound Metrics or Outbound Metrics tab
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::application-details
- text: The Product shows the application's edges and its request metrics for the chosen time
  kind: product
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Source, Destination, Request rate, Error rate]}, {entity: application, effect: reads, facts: [Inbound metrics, Outbound metrics]}]
  contexts:
    web:
      place: web-console::signed-in::application-details
---

# View an application

## Trigger

The User selects an application.

## Outcome

The User understands what the application is made of and how its traffic behaves.

## Edge cases

- Traffic and metrics tabs show only while Prometheus is available
- Runtime dashboards of the application's workloads appear as tabs of their own, as for a workload
- Metrics can be grouped by label, filtered, reported from the source or destination, and opened in Grafana or Perses when those are configured
