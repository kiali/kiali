---
kind: primary
routes:
  web: Web
steps:
- text: The User opens the Logs tab of a workload and picks a pod and its containers
  kind: actor
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Name, Containers]}, {entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product shows the log lines of those containers for the chosen time
  kind: product
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Logs]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The User shows or hides lines by text or expression
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# View pod logs

## Trigger

The User needs to see what a workload logged.

## Outcome

The User reads the matching log lines and can copy them.

## Edge cases

- Trace spans can be shown among the log lines
- JSON and Envoy access log lines open in a readable form
