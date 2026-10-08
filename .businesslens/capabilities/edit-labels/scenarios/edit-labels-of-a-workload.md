---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Edit labels on a workload and changes them
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Labels]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The User saves
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product writes the new labels to the workload
  kind: product
  actor: user
  entities: [{entity: workload, effect: changes, facts: [Labels]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# Edit labels of a workload

## Trigger

The User needs different labels on a workload.

## Outcome

The workload carries the saved labels.
