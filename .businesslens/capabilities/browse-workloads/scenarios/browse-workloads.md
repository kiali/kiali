---
kind: primary
routes:
  web: Web
steps:
- text: The User opens Workloads and picks namespaces
  kind: actor
  actor: user
  entities: [{entity: namespace, effect: reads, facts: [Name]}, {entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workloads
- text: The Product lists each workload with its type, health, labels and validations
  kind: product
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Type, Health, Labels, Validations, Missing sidecar]}, {entity: namespace, effect: reads, facts: [Name]}, {entity: cluster, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workloads
- text: The User filters and sorts by name, type, config type, sidecar presence, health, app or version label, or label
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workloads
---

# Browse workloads

## Trigger

The User looks for a workload.

## Outcome

The User finds a workload and can open one.
