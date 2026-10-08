---
kind: primary
routes:
  web: Web
steps:
- text: The User chooses Set Proxy Log Level and a level for the selected pod
  kind: actor
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product sets the level on the pod's proxy and confirms it
  kind: product
  actor: user
  entities: [{entity: pod, effect: changes, facts: [Proxy log level]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# Set a pod's proxy log level

## Trigger

The User needs more or less detail from a proxy.

## Outcome

The pod's proxy logs at the chosen level until it restarts.
