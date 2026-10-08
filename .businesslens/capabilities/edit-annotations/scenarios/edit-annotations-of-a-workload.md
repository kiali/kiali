---
kind: alternative
routes:
  web: Web
steps:
- text: The User chooses Edit annotations on a workload and changes them
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Annotations]}]
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
- text: The Product writes the new annotations to the workload
  kind: product
  actor: user
  entities: [{entity: workload, effect: changes, facts: [Annotations]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# Edit annotations of a workload

## Trigger

The User needs different annotations on a workload.

## Outcome

The workload carries the saved annotations.
