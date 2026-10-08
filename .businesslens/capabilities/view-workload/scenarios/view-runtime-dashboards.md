---
kind: alternative
routes:
  web: Web
steps:
- text: The User opens a workload that exposes a runtime such as Go, JVM or Quarkus
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The User opens the tab of that runtime's dashboard
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product charts the runtime's metrics for the chosen time
  kind: product
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Runtime metrics]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# View a workload's runtime dashboards

## Trigger

The User wants to see how the application runtime inside a workload behaves.

## Outcome

The User reads the runtime's own metrics beside the workload's traffic.

## Edge cases

- Runtime dashboards appear only while custom dashboards are enabled and Prometheus is available
