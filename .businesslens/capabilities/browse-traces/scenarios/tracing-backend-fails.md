---
kind: edge
routes:
  web: Web
steps:
- text: The User opens the distributed tracing tab of a workload
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The tracing backend cannot be reached or returns an error
  kind: condition
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product shows the error in place of the results and disables the filters
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# The tracing backend fails

## Trigger

The User looks for traces while the tracing backend is down or misconfigured.

## Outcome

No traces are shown, and the error also reaches the notification center.
