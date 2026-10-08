---
kind: validation
routes:
  web: Web
steps:
- text: The User opens the Logs tab of a workload
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: View only mode is on
  kind: condition
  entities: [{entity: kiali-configuration, effect: reads, facts: [View only mode]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product offers no log level choice and refuses any request to change it
  kind: product
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# The log level cannot change in view only mode

## Trigger

Kiali runs in view only mode.

## Outcome

The proxy's log level is unchanged.
