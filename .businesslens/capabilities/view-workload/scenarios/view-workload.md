---
kind: primary
routes:
  web: Web
steps:
- text: The User opens a workload
  kind: actor
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product shows its type, version, mode, auto injection, waypoint, health, labels, annotations and validations
  kind: product
  actor: user
  entities: [{entity: workload, effect: reads, facts: [Name, Type, Created, Version, Mode, Auto injection, Waypoint, Health, Labels, Annotations, Validations]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product lists its pods and whether each proxy is in sync with its control plane
  kind: product
  actor: user
  entities: [{entity: pod, effect: reads, facts: [Name, Status, Revision]}, {entity: workload, effect: reads, facts: [Istio proxy status]}, {entity: control-plane, effect: reads, facts: [Revision]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The User opens the Traffic, Inbound Metrics or Outbound Metrics tab
  kind: actor
  actor: user
  entities: []
  contexts:
    web:
      place: web-console::signed-in::workload-details
- text: The Product shows the workload's edges and its request metrics for the chosen time
  kind: product
  actor: user
  entities: [{entity: edge, effect: reads, facts: [Source, Destination, Request rate, Error rate]}, {entity: workload, effect: reads, facts: [Inbound metrics, Outbound metrics]}]
  contexts:
    web:
      place: web-console::signed-in::workload-details
---

# View a workload

## Trigger

The User selects a workload.

## Outcome

The User understands how the workload runs and how its traffic behaves.

## Edge cases

- Ztunnel and waypoint workloads show their captured services and workloads
